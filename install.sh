#!/bin/sh
set -eu

# The Git tag recorded by a published GitHub Release is the authoritative
# tooling version. With no explicit selection, GitHub resolves the latest
# release. Jenkins replaces the development placeholder in the published
# install.sh asset so the selected bootstrap and release.env cannot race across
# two releases; an explicit semantic version still selects an exact tag.
DOCUMENTATION_BOOTSTRAP_RELEASE_TAG=0.0.0
REQUESTED_VERSION=${DOCUMENTATION_TOOLS_VERSION:-}
if [ -z "${REQUESTED_VERSION}" ] &&
    [ "${DOCUMENTATION_BOOTSTRAP_RELEASE_TAG}" != "0.0.0" ]
then
    REQUESTED_VERSION=${DOCUMENTATION_BOOTSTRAP_RELEASE_TAG}
fi
RELEASE_BASE_URL=https://github.com/eSoul-cz/documentation-skill/releases
if [ -n "${REQUESTED_VERSION}" ]; then
    if ! printf '%s\n' "${REQUESTED_VERSION}" |
        grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'
    then
        echo "ERROR: Requested documentation tooling version is not semantic: ${REQUESTED_VERSION}" >&2
        exit 1
    fi
    RELEASE_MANIFEST_URL=${RELEASE_BASE_URL}/download/${REQUESTED_VERSION}/release.env
else
    RELEASE_MANIFEST_URL=${RELEASE_BASE_URL}/latest/download/release.env
fi

usage() {
    echo "Usage: install.sh [PROJECT_ROOT] [--upgrade [--apply]]" >&2
    exit 2
}

# The current directory is the ergonomic default for curl | sh. Resolve it to a
# physical absolute path before constructing the Docker mount, reject option-like
# input, and never allow the filesystem root to become the writable target.
project_argument=
upgrade=0
apply=0
for argument do
    case "${argument}" in
        --upgrade)
            [ "${upgrade}" -eq 0 ] || usage
            upgrade=1
            ;;
        --apply)
            [ "${apply}" -eq 0 ] || usage
            apply=1
            ;;
        -*|*'
'*)
            usage
            ;;
        *)
            [ -z "${project_argument}" ] || usage
            project_argument=${argument}
            ;;
    esac
done
project_argument=${project_argument:-.}
if [ "${apply}" -eq 1 ] && [ "${upgrade}" -ne 1 ]; then
    usage
fi
if [ ! -d "${project_argument}" ]; then
    echo "ERROR: Project root does not exist: ${project_argument}" >&2
    exit 1
fi
PROJECT_ROOT=$(CDPATH= cd "${project_argument}" && pwd -P)
if [ "${PROJECT_ROOT}" = "/" ]; then
    echo "ERROR: Refusing to install documentation tooling into the filesystem root." >&2
    exit 1
fi
MANAGED_MANIFEST="${PROJECT_ROOT}/docs/.documentation-tools/managed-files.json"
if [ "${upgrade}" -eq 1 ] && [ ! -f "${MANAGED_MANIFEST}" ]; then
    echo "ERROR: Documentation tooling is not installed; omit --upgrade for a new installation." >&2
    exit 1
fi
if [ "${upgrade}" -eq 0 ] && [ -f "${MANAGED_MANIFEST}" ]; then
    echo "ERROR: Documentation tooling is already installed; use --upgrade to preview an update." >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is required to install documentation tooling." >&2
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker is installed but the daemon is unavailable." >&2
    exit 1
fi

# Only the integration suite may redirect the manifest to a local fixture. The
# production path cannot override the release record or either trusted image.
if [ "${DOCUMENTATION_INSTALL_TEST_MODE:-0}" = "1" ]; then
    RELEASE_MANIFEST_URL=${DOCUMENTATION_RELEASE_MANIFEST_URL:-${RELEASE_MANIFEST_URL}}
elif [ -n "${DOCUMENTATION_RELEASE_MANIFEST_URL:-}${DOCUMENTATION_INSTALLER_IMAGE:-}${DOCUMENTATION_RENDERER_IMAGE:-}${DOCUMENTATION_RENDERER_PIN:-}" ]; then
    echo "ERROR: Installer trust inputs cannot be overridden outside test mode." >&2
    exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is required to resolve the published release manifest." >&2
    exit 1
fi
if ! release_manifest=$(curl -fsSL "${RELEASE_MANIFEST_URL}"); then
    echo "ERROR: Could not download documentation tooling release manifest: ${RELEASE_MANIFEST_URL}" >&2
    exit 1
fi

# The installer receives write access to the project, so extract only expected
# scalar fields; never source or execute the downloaded manifest.
manifest_value() {
    wanted=$1
    printf '%s\n' "${release_manifest}" |
        awk -F= -v wanted="${wanted}" '
            $1 == wanted {
                count++
                value = substr($0, length($1) + 2)
            }
            END {
                if (count != 1 || value == "") {
                    exit 1
                }
                print value
            }
        '
}
if ! RELEASE_TAG=$(manifest_value RELEASE_TAG) ||
    ! INSTALLER_IMAGE=$(manifest_value IMAGE_INSTALLER) ||
    ! RENDERER_IMAGE=$(manifest_value IMAGE_RENDERER)
then
    echo "ERROR: Release manifest is missing a unique tag or immutable image: ${RELEASE_MANIFEST_URL}" >&2
    exit 1
fi
if CONFIG_SCHEMA_VERSION=$(manifest_value CONFIG_SCHEMA_VERSION); then
    :
else
    case "${RELEASE_TAG}" in
        0.6.0|0.6.1)
            # These releases predate CONFIG_SCHEMA_VERSION in release.env and
            # both use the original project configuration schema.
            CONFIG_SCHEMA_VERSION=1
            ;;
        *)
            echo "ERROR: Release manifest is missing CONFIG_SCHEMA_VERSION: ${RELEASE_MANIFEST_URL}" >&2
            exit 1
            ;;
    esac
fi
if ! printf '%s\n' "${RELEASE_TAG}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "ERROR: Release manifest tag is not semantic: ${RELEASE_TAG}" >&2
    exit 1
fi
if ! printf '%s\n' "${CONFIG_SCHEMA_VERSION}" | grep -Eq '^[1-9][0-9]*$'; then
    echo "ERROR: Release manifest configuration schema is not a positive integer." >&2
    exit 1
fi
if [ -n "${REQUESTED_VERSION}" ] && [ "${RELEASE_TAG}" != "${REQUESTED_VERSION}" ]; then
    echo "ERROR: Release manifest tag ${RELEASE_TAG} does not match requested version ${REQUESTED_VERSION}." >&2
    exit 1
fi
if printf '%s\n' "${INSTALLER_IMAGE}" |
    grep -Eq '^[^[:space:]@]+@sha256:[0-9a-f]{64}$'
then
    :
elif [ "${DOCUMENTATION_INSTALL_TEST_MODE:-0}" = "1" ] &&
    printf '%s\n' "${INSTALLER_IMAGE}" |
        grep -Eq '^sha256:[0-9a-f]{64}$'
then
    # Integration tests may execute a locally built image by immutable image ID.
    :
else
    echo "ERROR: Installer image must be pinned by an immutable sha256 digest." >&2
    exit 1
fi
if ! printf '%s\n' "${RENDERER_IMAGE}" |
    grep -Eq '^[^[:space:]@]+@sha256:[0-9a-f]{64}$'
then
    echo "ERROR: Renderer image must be pinned by an immutable sha256 digest." >&2
    exit 1
fi

# Pull the public installer before mounting the project. A plan does not execute
# the renderer, so it avoids downloading that larger image until application.
# Test-only overrides can provide prebuilt local images.
if [ "${DOCUMENTATION_INSTALL_SKIP_PULL:-0}" != "1" ]; then
    echo "Pulling documentation installer ${INSTALLER_IMAGE}..."
    docker pull "${INSTALLER_IMAGE}"
    if [ "${upgrade}" -eq 0 ] || [ "${apply}" -eq 1 ]; then
        echo "Pulling documentation renderer ${RENDERER_IMAGE}..."
        docker pull "${RENDERER_IMAGE}"
    fi
fi

# The release manifest already pins the renderer by immutable digest.
renderer_pin=${RENDERER_IMAGE}

# The digest-pinned installer container is deliberately more restricted than
# the renderer. It receives no network or capabilities. Upgrade previews mount
# the project read-only; fresh installs and approved upgrades are transactional
# writes performed by the target release's installer.
project_mount_mode=rw
if [ "${upgrade}" -eq 1 ] && [ "${apply}" -eq 0 ]; then
    project_mount_mode=ro
    echo "Planning remote-profile documentation tooling upgrade in ${PROJECT_ROOT}..."
elif [ "${upgrade}" -eq 1 ]; then
    echo "Applying remote-profile documentation tooling upgrade in ${PROJECT_ROOT}..."
else
    echo "Installing remote-profile documentation tooling in ${PROJECT_ROOT}..."
fi
set -- docker run \
    --rm \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --pids-limit 64 \
    --network none \
    --user "$(id -u):$(id -g)" \
    --volume "${PROJECT_ROOT}:/project:${project_mount_mode}" \
    "${INSTALLER_IMAGE}"
if [ "${upgrade}" -eq 1 ]; then
    operation=--plan-remote-upgrade
    if [ "${apply}" -eq 1 ]; then
        operation=--apply-remote-upgrade
    fi
    set -- "$@" \
        "${operation}" \
        --target-version "${RELEASE_TAG}" \
        --target-image "${renderer_pin}" \
        --target-config-schema "${CONFIG_SCHEMA_VERSION}" \
        --display-project-root "${PROJECT_ROOT}" \
        /project
else
    set -- "$@" \
        --profile remote \
        --config-template /opt/documentation-tools/documentation.toml \
        --renderer-image "${renderer_pin}" \
        /project
fi
"$@"

if [ "${upgrade}" -eq 1 ] && [ "${apply}" -eq 0 ]; then
    echo "Upgrade preview is complete. Re-run the same command with --apply after review."
    exit 0
fi

# A local Git setting provides an untracked trust source independent from the
# project-owned documentation.toml. CI and non-Git directories must supply the
# equivalent DOCUMENTATION_REMOTE_RENDERER_IMAGE environment variable.
trust_from_git=0
if command -v git >/dev/null 2>&1 &&
    git -C "${PROJECT_ROOT}" rev-parse --git-dir >/dev/null 2>&1
then
    git -C "${PROJECT_ROOT}" config \
        --local \
        documentation.remoteRendererImage \
        "${renderer_pin}"
    trust_from_git=1
    echo "Recorded the trusted renderer digest in local Git configuration."
else
    echo "This project is not a Git worktree; export the renderer allowlist before using the tooling:"
    echo "  export DOCUMENTATION_REMOTE_RENDERER_IMAGE='${renderer_pin}'"
fi

# Doctor validates the installed manifest, configuration, Docker readiness,
# public registry access, and the independently stored renderer pin.
if [ "${DOCUMENTATION_INSTALL_SKIP_DOCTOR:-0}" != "1" ]; then
    echo "Running documentation tooling diagnostics..."
    doctor_status=0
    if [ "${trust_from_git}" -eq 1 ]; then
        "${PROJECT_ROOT}/docs/documentation" doctor || doctor_status=$?
    else
        DOCUMENTATION_REMOTE_RENDERER_IMAGE="${renderer_pin}" \
            "${PROJECT_ROOT}/docs/documentation" doctor || doctor_status=$?
    fi
    if [ "${doctor_status}" -ne 0 ]; then
        if [ "${upgrade}" -eq 1 ]; then
            echo "ERROR: The internally consistent upgrade was retained, but doctor diagnostics failed." >&2
        else
            echo "ERROR: Tooling was installed, but doctor diagnostics failed." >&2
        fi
        exit "${doctor_status}"
    fi
    echo "Post-installation doctor diagnostics passed."
fi

if [ "${upgrade}" -eq 1 ]; then
    echo "Documentation tooling upgrade is complete."
else
    echo "Documentation tooling setup is complete."
fi
echo "Next: review docs/documentation.toml, then run docs/documentation validate."
