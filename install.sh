#!/bin/sh
set -eu

# The Git tag recorded by a published GitHub Release is the authoritative
# tooling version. With no explicit selection, GitHub resolves the latest
# release; an explicit semantic version selects that immutable tagged release.
REQUESTED_VERSION=${DOCUMENTATION_TOOLS_VERSION:-}
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
    echo "Usage: install.sh [PROJECT_ROOT]" >&2
    exit 2
}

if [ "$#" -gt 1 ]; then
    usage
fi

# The current directory is the ergonomic default for curl | sh. Resolve it to a
# physical absolute path before constructing the Docker mount, reject option-like
# input, and never allow the filesystem root to become the writable target.
project_argument=${1:-.}
case "${project_argument}" in
    -*|*'
'*)
        usage
        ;;
esac
if [ ! -d "${project_argument}" ]; then
    echo "ERROR: Project root does not exist: ${project_argument}" >&2
    exit 1
fi
PROJECT_ROOT=$(CDPATH= cd "${project_argument}" && pwd -P)
if [ "${PROJECT_ROOT}" = "/" ]; then
    echo "ERROR: Refusing to install documentation tooling into the filesystem root." >&2
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
if ! printf '%s\n' "${RELEASE_TAG}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "ERROR: Release manifest tag is not semantic: ${RELEASE_TAG}" >&2
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

# Pull both public images up front so registry failures occur before the project
# is mounted read-write. Test-only overrides can provide prebuilt local images.
if [ "${DOCUMENTATION_INSTALL_SKIP_PULL:-0}" != "1" ]; then
    echo "Pulling documentation installer ${INSTALLER_IMAGE}..."
    docker pull "${INSTALLER_IMAGE}"
    echo "Pulling documentation renderer ${RENDERER_IMAGE}..."
    docker pull "${RENDERER_IMAGE}"
fi

# The release manifest already pins the renderer by immutable digest.
renderer_pin=${RENDERER_IMAGE}

# The digest-pinned installer container is deliberately more restricted than
# the renderer. It receives no network, capabilities, or writable filesystem
# beyond the selected project mount. Its image embeds only the remote profile.
echo "Installing remote-profile documentation tooling in ${PROJECT_ROOT}..."
docker run \
    --rm \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --pids-limit 64 \
    --network none \
    --user "$(id -u):$(id -g)" \
    --volume "${PROJECT_ROOT}:/project:rw" \
    "${INSTALLER_IMAGE}" \
    --profile remote \
    --config-template /opt/documentation-tools/documentation.toml \
    --renderer-image "${renderer_pin}" \
    /project

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

# Doctor validates the installed manifest, catalog, configuration, Docker
# readiness, public registry access, and the independently stored renderer pin.
if [ "${DOCUMENTATION_INSTALL_SKIP_DOCTOR:-0}" != "1" ]; then
    echo "Running documentation tooling diagnostics..."
    if [ "${trust_from_git}" -eq 1 ]; then
        "${PROJECT_ROOT}/docs/documentation" doctor
    else
        DOCUMENTATION_REMOTE_RENDERER_IMAGE="${renderer_pin}" \
            "${PROJECT_ROOT}/docs/documentation" doctor
    fi
fi

echo "Documentation tooling setup is complete."
echo "Next: review docs/documentation.toml, then run docs/documentation validate."
