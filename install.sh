#!/bin/sh
set -eu

# These defaults describe one immutable semantic tooling release in the public
# Scaleway registry. Environment overrides support testing, mirrors, and an
# explicitly selected published version without requiring a different script.
TOOL_VERSION=${DOCUMENTATION_TOOLS_VERSION:-0.6.0}
PUBLIC_REGISTRY=${DOCUMENTATION_PUBLIC_REGISTRY:-rg.fr-par.scw.cloud/esoul-internal-tools}
INSTALLER_IMAGE=${DOCUMENTATION_INSTALLER_IMAGE:-${PUBLIC_REGISTRY}/documentation-tools-installer:${TOOL_VERSION}}
RENDERER_IMAGE=${DOCUMENTATION_RENDERER_IMAGE:-${PUBLIC_REGISTRY}/documentation-tools:${TOOL_VERSION}}

usage() {
    echo "Usage: curl -fsSL https://raw.githubusercontent.com/eSoul-cz/documentation-skill/main/install.sh | sh -s -- [PROJECT_ROOT]" >&2
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

# Pull both public images up front so registry failures occur before the project
# is mounted read-write. Test-only overrides can provide prebuilt local images.
if [ "${DOCUMENTATION_INSTALL_SKIP_PULL:-0}" != "1" ]; then
    echo "Pulling documentation installer ${INSTALLER_IMAGE}..."
    docker pull "${INSTALLER_IMAGE}"
    if [ -z "${DOCUMENTATION_RENDERER_PIN:-}" ]; then
        echo "Resolving documentation renderer ${RENDERER_IMAGE}..."
        docker pull "${RENDERER_IMAGE}"
    fi
fi

# Project configuration and the runtime allowlist use a digest, never a mutable
# tag. Docker records the registry digest after pulling the semantic release tag.
renderer_pin=${DOCUMENTATION_RENDERER_PIN:-}
if [ -z "${renderer_pin}" ]; then
    renderer_repository=${RENDERER_IMAGE%:*}
    repo_digests=$(
        docker image inspect \
            --format '{{range .RepoDigests}}{{println .}}{{end}}' \
            "${RENDERER_IMAGE}"
    )
    for candidate in ${repo_digests}; do
        case "${candidate}" in
            "${renderer_repository}"@sha256:*)
                renderer_pin=${candidate}
                break
                ;;
        esac
    done
fi
if ! printf '%s\n' "${renderer_pin}" |
    grep -Eq '^[^[:space:]@]+@sha256:[0-9a-f]{64}$'
then
    echo "ERROR: Could not resolve an immutable renderer digest for ${RENDERER_IMAGE}." >&2
    exit 1
fi

# The installer container is deliberately more restricted than the renderer. It
# receives no network, capabilities, or writable filesystem beyond the selected
# project mount. Its image embeds only the remote-profile managed bundle.
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
