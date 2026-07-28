@Library(['dockerHelpers']) _

pipeline {
	agent any

	options {
		disableConcurrentBuilds()
		timestamps()
		timeout(time: 120, unit: 'MINUTES')
	}

	environment {
		REGISTRY = 'rg.fr-par.scw.cloud/esoul-internal-tools'
		REGISTRY_HOST = 'rg.fr-par.scw.cloud'
		RENDERER_IMAGE = 'documentation-tools'
		INSTALLER_IMAGE = 'documentation-tools-installer'
		RENDERER_CONTEXT = 'tooling/project-tools/docs/.documentation-tools/pdf'
		RENDERER_DOCKERFILE = 'tooling/project-tools/docs/.documentation-tools/pdf/Dockerfile'
		INSTALLER_DOCKERFILE = 'tooling/install-project-tools/Dockerfile'
		VERSION_FILE = 'tooling/project-tools/docs/.documentation-tools/VERSION'
		RELEASE_CATALOG_TOOL = 'tooling/project-tools/docs/.documentation-tools/release-catalog'
		RELEASE_CATALOG_DIR = 'tooling/project-tools/docs/.documentation-tools/releases'
		GITHUB_REPOSITORY = 'eSoul-cz/documentation-skill'
		GITHUB_RELEASE_CREDENTIALS_ID = 'github-documentation-skill-release-token'
		COSIGN_PRIVATE_KEY_CREDENTIALS_ID = 'cosign-documentation-skill-private-key'
		COSIGN_KEY_PASSWORD_CREDENTIALS_ID = 'cosign-documentation-skill-key-password'
	}

	stages {
		stage('Verify tooling') {
			steps {
				sh "${env.RELEASE_CATALOG_TOOL} validate"
				sh 'tooling/scripts/test_release_catalog'
				sh 'tooling/scripts/test_renderer_smoke'
				sh 'tooling/scripts/test_bootstrap_install'
			}
		}

		stage('Build and publish tooling images') {
			when {
				anyOf {
					branch 'main'
					branch 'master'
					buildingTag()
				}
			}

			steps {
				script {
					def version = sh(
						script: "sed -n '1p' '${env.VERSION_FILE}'",
						returnStdout: true
					).trim()
					if (!(version ==~ /\d+\.\d+\.\d+/)) {
						error("Renderer VERSION is not semantic: ${version}")
					}

					def buildTags = [version, 'latest']
					def gitTags = sh(
						script: 'git tag --points-at HEAD',
						returnStdout: true
					).trim().split('\n').findAll { it }
					if (!gitTags.contains(version)) {
						echo "Skipping release publication because tag ${version} does not point at HEAD."
						return
					}
					gitTags.each { tag ->
						if (tag ==~ /[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}/ && !buildTags.contains(tag)) {
							buildTags.add(tag)
						}
					}

					def versionImage = "${env.REGISTRY}/${env.RENDERER_IMAGE}:${version}"
					def installerVersionImage = "${env.REGISTRY}/${env.INSTALLER_IMAGE}:${version}"
					def hasRequiredPlatforms = { image ->
						def platforms = sh(
							script: "docker buildx imagetools inspect '${image}' 2>/dev/null | sed -n 's/^[[:space:]]*Platform:[[:space:]]*//p' | sort -u",
							returnStdout: true
						).trim().split('\n').findAll { it }
						return platforms.contains('linux/amd64') && platforms.contains('linux/arm64')
					}
					def hasRequiredAttestations = { image ->
						return sh(
							script: """#!/bin/sh
								set -eu
								docker buildx imagetools inspect '${image}' --raw |
									grep -E '"vnd\\.docker\\.reference\\.type"[[:space:]]*:[[:space:]]*"attestation-manifest"' >/dev/null
								sbom_json=\$(docker buildx imagetools inspect '${image}' --format '{{ json .SBOM }}')
								test "\$(printf '%s' "\${sbom_json}" | tr -d '[:space:]')" != 'null'
								printf '%s' "\${sbom_json}" | grep -F '"SPDX"' >/dev/null
								provenance_json=\$(docker buildx imagetools inspect '${image}' --format '{{ json .Provenance.SLSA }}')
								test "\$(printf '%s' "\${provenance_json}" | tr -d '[:space:]')" != 'null'
							""",
							returnStatus: true
						) == 0
					}
					def rendererExists = hasRequiredPlatforms(versionImage) && hasRequiredAttestations(versionImage)
					def installerExists = hasRequiredPlatforms(installerVersionImage) && hasRequiredAttestations(installerVersionImage)

					if (rendererExists) {
						echo "Reusing already published renderer ${versionImage}."
					} else {
						echo "Building and publishing renderer ${version} for amd64 and arm64..."
						withCredentials([string(credentialsId: 'scaleway_secret_key', variable: 'SECRET')]) {
							dockerBuildMultiArch(
								registry: env.REGISTRY,
								registryHost: env.REGISTRY_HOST,
								registryPassword: env.SECRET,
								image: env.RENDERER_IMAGE,
								contextDir: env.RENDERER_CONTEXT,
								tags: buildTags,
								dockerfile: env.RENDERER_DOCKERFILE,
								sbom: true,
								provenance: 'max',
							)
						}
					}
					if (!hasRequiredPlatforms(versionImage) || !hasRequiredAttestations(versionImage)) {
						error("Renderer ${versionImage} is missing required platforms or BuildKit attestations.")
					}

					def digest = sh(
						script: "docker buildx imagetools inspect '${versionImage}' | sed -n 's/^Digest:[[:space:]]*//p' | sed -n '1p'",
						returnStdout: true
					).trim()
					if (!(digest ==~ /sha256:[a-f0-9]{64}/)) {
						error("Could not resolve immutable digest for ${versionImage}")
					}

					def immutableImage = "${env.REGISTRY}/${env.RENDERER_IMAGE}@${digest}"
					def publishedAt = sh(
						script: "date -u '+%Y-%m-%dT%H:%M:%SZ'",
						returnStdout: true
					).trim()
					def sourceCommit = sh(
						script: 'git rev-parse HEAD',
						returnStdout: true
					).trim()
					def baseRendererReleaseFields = [
						'CATALOG_SCHEMA_VERSION=1',
						"RENDERER_VERSION=${version}",
						"RENDERER_IMAGE=${immutableImage}",
						'ARCHITECTURES=linux/amd64,linux/arm64',
						"PUBLISHED_AT=${publishedAt}",
						"SOURCE_COMMIT=${sourceCommit}",
						'CONFIG_SCHEMA_VERSION=1',
						'RELEASE_STATUS=active',
						'UPGRADE_NOTES=Adds named themes, eSoul client branding, project-local fonts, styled footnotes and callouts, configurable link notices, doctor diagnostics, and transactional hosted upgrades; configuration schema remains 1.',
						"DOCUMENTATION_RENDERER_VERSION=${version}",
						"DOCUMENTATION_REMOTE_RENDERER_IMAGE=${immutableImage}",
					]
					def rendererReleaseFields = baseRendererReleaseFields + [
						'SBOM=unavailable',
						'SCAN=unavailable',
						'PROVENANCE=unavailable',
						'SIGNATURE=unavailable',
					]
					def rendererReleaseEntry = (rendererReleaseFields + ['']).join('\n')
					writeFile(
						file: "release-catalog-candidate/${version}.env",
						text: rendererReleaseEntry
					)
					writeFile(
						file: 'release-catalog-candidate/LATEST',
						text: "${version}\n"
					)
					sh "DOCUMENTATION_RELEASE_CATALOG_ALLOW_RENDERER_ONLY_CANDIDATE=1 DOCUMENTATION_RELEASE_CATALOG_ALLOW_UNAVAILABLE_SUPPLY_CHAIN_CANDIDATE=1 DOCUMENTATION_RELEASE_CATALOG_DIR=release-catalog-candidate ${env.RELEASE_CATALOG_TOOL} validate"
					sh """
						cp 'release-catalog-candidate/${version}.env' '${env.RELEASE_CATALOG_DIR}/${version}.env'
						cp 'release-catalog-candidate/LATEST' '${env.RELEASE_CATALOG_DIR}/LATEST'
						DOCUMENTATION_RELEASE_CATALOG_ALLOW_RENDERER_ONLY_CANDIDATE=1 DOCUMENTATION_RELEASE_CATALOG_ALLOW_UNAVAILABLE_SUPPLY_CHAIN_CANDIDATE=1 ${env.RELEASE_CATALOG_TOOL} validate
					"""

					if (installerExists) {
						echo "Reusing already published installer ${installerVersionImage}."
					} else {
						echo "Building and publishing bootstrap installer ${version} for amd64 and arm64..."
						withCredentials([string(credentialsId: 'scaleway_secret_key', variable: 'SECRET')]) {
							dockerBuildMultiArch(
								registry: env.REGISTRY,
								registryHost: env.REGISTRY_HOST,
								registryPassword: env.SECRET,
								image: env.INSTALLER_IMAGE,
								contextDir: '.',
								tags: buildTags,
								dockerfile: env.INSTALLER_DOCKERFILE,
								sbom: true,
								provenance: 'max',
							)
						}
					}
					if (!hasRequiredPlatforms(installerVersionImage) || !hasRequiredAttestations(installerVersionImage)) {
						error("Installer ${installerVersionImage} is missing required platforms or BuildKit attestations.")
					}
					def installerDigest = sh(
						script: "docker buildx imagetools inspect '${installerVersionImage}' | sed -n 's/^Digest:[[:space:]]*//p' | sed -n '1p'",
						returnStdout: true
					).trim()
					if (!(installerDigest ==~ /sha256:[a-f0-9]{64}/)) {
						error("Could not resolve immutable digest for ${installerVersionImage}")
					}
					def immutableInstallerImage = "${env.REGISTRY}/${env.INSTALLER_IMAGE}@${installerDigest}"

					def artifacts = publishContainerReleaseArtifacts(
						githubRepository: env.GITHUB_REPOSITORY,
						releaseTag: version,
						sourceCommit: sourceCommit,
						images: [
							renderer: [
								reference: immutableImage,
								assetName: env.RENDERER_IMAGE,
							],
							installer: [
								reference: immutableInstallerImage,
								assetName: env.INSTALLER_IMAGE,
							],
						],
						githubCredentialsId: env.GITHUB_RELEASE_CREDENTIALS_ID,
						signing: [
							credentialsId: env.COSIGN_PRIVATE_KEY_CREDENTIALS_ID,
							passwordCredentialsId: env.COSIGN_KEY_PASSWORD_CREDENTIALS_ID,
							registryStorage: 'bundle',
						],
						scan: [enabled: true],
						outputDirectory: 'build/release-artifacts',
						publishRelease: true,
						requireExistingTag: true,
					)
					def rendererArtifacts = artifacts.images.renderer
					def finalRendererReleaseFields = baseRendererReleaseFields + [
						"SBOM=${rendererArtifacts.sbom}",
						"SCAN=${rendererArtifacts.scan}",
						"PROVENANCE=${rendererArtifacts.provenance}",
						"SIGNATURE=${rendererArtifacts.signature}",
					]
					def releaseEntry = (finalRendererReleaseFields + [
						"INSTALLER_IMAGE=${immutableInstallerImage}",
						''
					]).join('\n')
					writeFile(
						file: "documentation-renderer-${version}.env",
						text: releaseEntry
					)
					writeFile(
						file: "release-catalog-candidate/${version}.env",
						text: releaseEntry
					)
					sh "DOCUMENTATION_RELEASE_CATALOG_DIR=release-catalog-candidate ${env.RELEASE_CATALOG_TOOL} validate"
					sh """
						cp 'release-catalog-candidate/${version}.env' '${env.RELEASE_CATALOG_DIR}/${version}.env'
						${env.RELEASE_CATALOG_TOOL} validate
					"""
					writeFile(
						file: "documentation-installer-${version}.env",
						text: [
							"DOCUMENTATION_INSTALLER_VERSION=${version}",
							"DOCUMENTATION_INSTALLER_IMAGE=${immutableInstallerImage}",
							''
						].join('\n')
					)
					archiveArtifacts(
						artifacts: "documentation-renderer-${version}.env,documentation-installer-${version}.env,release-catalog-candidate/*,build/release-artifacts/*",
						allowEmptyArchive: false,
						fingerprint: true
					)
					echo "Published immutable renderer: ${immutableImage}"
					echo "Published immutable installer: ${immutableInstallerImage}"
					echo "Published signed release artifacts: ${artifacts.releaseUrl}"
					echo "Archive release-catalog-candidate/ in a reviewed follow-up commit to make this release durably resolvable."
				}
			}
		}
	}

	post {
		always {
			sh '''
				version=$(sed -n '1p' "${VERSION_FILE}")
				docker image rm "esoul-documentation-tools:${version}-smoke" >/dev/null 2>&1 || true
			'''
		}
		success {
			echo 'Documentation tooling pipeline completed successfully.'
		}
		failure {
			echo 'Documentation tooling pipeline failed.'
		}
	}
}
