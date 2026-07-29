@Library(['dockerHelpers']) _

pipeline {
	agent any

	options {
		disableConcurrentBuilds()
		skipDefaultCheckout(true)
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
		GITHUB_REPOSITORY = 'eSoul-cz/documentation-skill'
		GITHUB_RELEASE_CREDENTIALS_ID = 'github-documentation-skill-release-token'
		SCALEWAY_REGISTRY_CREDENTIALS_ID = 'scaleway_secret_key'
		COSIGN_PRIVATE_KEY_CREDENTIALS_ID = 'cosign-documentation-skill-private-key'
		COSIGN_KEY_PASSWORD_CREDENTIALS_ID = 'cosign-documentation-skill-key-password'
	}

	stages {
		stage('Checkout') {
			steps {
				deleteDir()
				checkout scm
			}
		}

		stage('Resolve tooling version') {
			steps {
				script {
					def releaseTag = env.TAG_NAME?.trim()
					if (releaseTag && !(releaseTag ==~ /\d+\.\d+\.\d+/)) {
						error("Release tag is not semantic: ${releaseTag}")
					}
					env.DOCUMENTATION_TOOLS_VERSION = releaseTag ?: '0.0.0'
					echo(releaseTag
						? "Using authoritative release tag ${releaseTag}."
						: 'Using development tooling version 0.0.0.')
				}
			}
		}

		stage('Verify tooling') {
			steps {
				sh 'tooling/scripts/test_tooling_version'
				sh 'tooling/scripts/test_bootstrap_manifest'
				sh 'tooling/scripts/test_documentation_wrapper'
				sh 'tooling/scripts/test_renderer_smoke'
				sh 'tooling/scripts/test_bootstrap_install'
			}
		}

		stage('Build and publish tooling images') {
			when {
				buildingTag()
			}

			steps {
				script {
					def version = env.DOCUMENTATION_TOOLS_VERSION
					def buildTags = [version, 'latest']
					def releaseImageConfig = [
						registry: env.REGISTRY,
						registryHost: env.REGISTRY_HOST,
						registryCredentialsId: env.SCALEWAY_REGISTRY_CREDENTIALS_ID,
						tags: buildTags,
						sbom: true,
						provenance: 'max',
					]
					def rendererImage = dockerEnsureMultiArchImage(
						releaseImageConfig + [
							image: env.RENDERER_IMAGE,
							contextDir: env.RENDERER_CONTEXT,
							dockerfile: env.RENDERER_DOCKERFILE,
						]
					)
					def immutableImage = rendererImage.immutableReference
					def sourceCommit = sh(
						script: 'git rev-parse HEAD',
						returnStdout: true
					).trim()
					def bootstrapVersionMarker = 'DOCUMENTATION_BOOTSTRAP_RELEASE_TAG=0.0.0'
					def bootstrapScript = readFile(file: 'install.sh')
					if (!bootstrapScript.contains(bootstrapVersionMarker)) {
						error('install.sh is missing its release-tag injection marker.')
					}
					bootstrapScript = bootstrapScript.replace(
						bootstrapVersionMarker,
						"DOCUMENTATION_BOOTSTRAP_RELEASE_TAG=${version}"
					)

					def installerImage = dockerEnsureMultiArchImage(
						releaseImageConfig + [
							image: env.INSTALLER_IMAGE,
							contextDir: '.',
							dockerfile: env.INSTALLER_DOCKERFILE,
							dockerfileArgs: [
								DOCUMENTATION_TOOLS_VERSION: version,
							],
						]
					)
					def immutableInstallerImage = installerImage.immutableReference

					def artifacts = publishContainerReleaseArtifacts(
						githubRepository: env.GITHUB_REPOSITORY,
						releaseTag: version,
						sourceCommit: sourceCommit,
						releaseMetadata: [
							CONFIG_SCHEMA_VERSION: '1',
							UPGRADE_NOTES: 'Adds named themes, eSoul client branding, project-local fonts, styled footnotes and callouts, configurable link notices, doctor diagnostics, and transactional hosted upgrades; configuration schema remains 1.',
						],
						releaseFiles: [
							'install.sh': bootstrapScript,
						],
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
					archiveArtifacts(
						artifacts: 'build/release-artifacts/*',
						allowEmptyArchive: false,
						fingerprint: true
					)
					echo "Published immutable renderer: ${immutableImage}"
					echo "Published immutable installer: ${immutableInstallerImage}"
					echo "Published signed release artifacts: ${artifacts.releaseUrl}"
				}
			}
		}
	}

	post {
		always {
			sh '''
				docker image rm \
					"esoul-documentation-tools:${DOCUMENTATION_TOOLS_VERSION:-0.0.0}-smoke" \
					>/dev/null 2>&1 || true
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
