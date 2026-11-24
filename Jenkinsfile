@Library(['testing', 'dockerHelpers']) _

// True when the previous build of this job did not succeed or there is none. A `changeset` condition only sees the
// commits since the previous build, so after a red build every stage runs again instead of skipping the broken one.
def previousBuildFailed() {
	def previous = currentBuild.previousBuild
	return previous == null || previous.result != 'SUCCESS'
}

pipeline {
	// A branch or pull request build only verifies, which takes minutes: it may run on the
	// Quick node (label quick, reserved for the quick jobs of the infrastructure repositories)
	// or on a general one, and has to end within the 15 minutes that node allows. A tag build
	// publishes the multi-arch images and waits for the image builders, and a build of the
	// default branch (the weekly scheduled build runs every stage there), so both stay on a
	// general node with a long limit.
	agent { label((env.TAG_NAME || env.BRANCH_NAME == 'master') ? 'general' : 'quick || general') }

	// The full run every Monday morning on the default branch: every test group and the upstream release check.
	triggers {
		cron(env.BRANCH_NAME == 'master' ? 'H H(4-6) * * 1' : '')
	}

	options {
		disableConcurrentBuilds()
		skipDefaultCheckout(true)
		timestamps()
		timeout(time: env.TAG_NAME ? 120 : (env.BRANCH_NAME == 'master' ? 45 : 15), unit: 'MINUTES')
	}

	environment {
		REGISTRY = 'rg.fr-par.scw.cloud/esoul-internal-tools'
		REGISTRY_HOST = 'rg.fr-par.scw.cloud'
		RENDERER_IMAGE = 'documentation-tools'
		INSTALLER_IMAGE = 'documentation-tools-installer'
		RENDERER_CONTEXT = 'tooling/project-tools/docs/.documentation-tools/pdf'
		RENDERER_DOCKERFILE = 'tooling/project-tools/docs/.documentation-tools/pdf/Dockerfile'
		INSTALLER_DOCKERFILE = 'tooling/install-project-tools/Dockerfile'
		GITHUB_REPOSITORY = 'eSoul-cz/skills'
		GITHUB_RELEASE_CREDENTIALS_ID = 'github-documentation-skill-release-token'
		SCALEWAY_REGISTRY_CREDENTIALS_ID = 'scaleway_secret_key'
		COSIGN_PRIVATE_KEY_CREDENTIALS_ID = 'cosign-documentation-skill-private-key'
		COSIGN_KEY_PASSWORD_CREDENTIALS_ID = 'cosign-documentation-skill-key-password'
		// The images the Node and Python test stages run in (runCommandInTest). The full Debian images, not alpine or slim:
		// `skills add --list` clones with git, which the small images lack.
		NODE_TEST_IMAGE = 'node:22'
		PYTHON_TEST_IMAGE = 'python:3'
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
					// A `plugin-<version>` tag releases the agent plugin (README): it only verifies. A bare
					// `<version>` tag releases the documentation tooling.
					env.PLUGIN_RELEASE = (releaseTag && releaseTag ==~ /plugin-\d+\.\d+\.\d+/) ? 'true' : 'false'
					if (releaseTag && env.PLUGIN_RELEASE != 'true' && !(releaseTag ==~ /\d+\.\d+\.\d+/)) {
						error("Release tag is not semantic: ${releaseTag}")
					}
					env.DOCUMENTATION_TOOLS_VERSION = (releaseTag && env.PLUGIN_RELEASE != 'true') ? releaseTag : '0.0.0'
					echo(releaseTag
						? "Using authoritative release tag ${releaseTag}."
						: 'Using development tooling version 0.0.0.')
				}
			}
		}

		// The release notes of a tooling release are the `## <version>` section of tooling/CHANGELOG.md. A missing or empty
		// section fails the tag build before anything is built or published.
		stage('Read release notes') {
			when {
				allOf {
					buildingTag()
					expression { env.PLUGIN_RELEASE != 'true' }
				}
			}
			steps {
				script {
					// returnStdout: the notes are the output of the script; a missing or empty section exits non-zero and fails the step.
					env.UPGRADE_NOTES = runCommandInTest(
						image: env.NODE_TEST_IMAGE,
						command: "node tooling/scripts/release_notes.mjs '${env.DOCUMENTATION_TOOLS_VERSION}'".toString(),
						returnStdout: true
					)
					echo "Release notes: ${env.UPGRADE_NOTES}"
				}
			}
		}

		// Each test group runs when its files changed, and always on a tag, on the scheduled build and after a build that
		// did not succeed (a changeset only lists the commits since the previous build, so a red build must not turn
		// green by skipping the stage that failed). `changeset` patterns are Ant patterns.
		stage('Verify skills') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/**'
					changeset 'agents/**'
					changeset 'hooks/**'
					changeset 'codex/**'
					changeset 'lib/**'
					changeset 'bin/**'
					changeset 'layers.json'
					changeset 'package.json'
					changeset 'README.md'
					changeset '.claude-plugin/**'
					changeset 'tooling/scripts/**'
					changeset 'Jenkinsfile'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills contract')
			}
		}

		stage('Verify review scripts') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/dev/esoul-review/**'
					changeset 'tooling/review-evals/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills review')
			}
		}

		// One stage per skill folder that holds Node tests. The 'Verify skills' stage fails when a skill with tests is missing here.
		stage('Verify skill scripts: esoul-task-work') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/core/esoul-task-work/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/core/esoul-task-work')
			}
		}

		stage('Verify skill scripts: esoul-project-lifecycle') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/project/esoul-project-lifecycle/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/project/esoul-project-lifecycle')
			}
		}

		stage('Verify skill scripts: esoul-project-update') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/project/esoul-project-update/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/project/esoul-project-update')
			}
		}

		stage('Verify skill scripts: esoul-quality-gates') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/project/esoul-quality-gates/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/project/esoul-quality-gates')
			}
		}

		stage('Verify skill scripts: esoul-uat') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/project/esoul-uat/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/project/esoul-uat')
			}
		}

		stage('Verify skill scripts: esoul-website-launch') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/project/esoul-website-launch/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/project/esoul-website-launch')
			}
		}

		stage('Verify skill scripts: esoul-mockup-authoring') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/project/esoul-mockup-authoring/**'
					changeset 'tooling/scripts/**'
				}
			}
			steps {
				runCommandInTest(image: env.NODE_TEST_IMAGE, command: 'tooling/scripts/test_skills skills/project/esoul-mockup-authoring')
			}
		}

		// The Python tests of the skills (stdlib unittest, in the python:3 image). The mockup
		// preview test (tooling/scripts/test_mockup_preview.mjs) needs an application checkout and Chrome and stays manual.
		stage('Verify Python scripts') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'skills/**/*.py'
					changeset 'skills/**/requirements*.txt'
					changeset 'tooling/scripts/test_python'
				}
			}
			steps {
				runCommandInTest(image: env.PYTHON_TEST_IMAGE, command: 'tooling/scripts/test_python')
			}
		}

		// The rules rendered by `esoul-guidelines` are current and unedited. The check runs the installer version the project recorded
		// in esoul-guidelines.lock (that release's PHAR, checksum verified, in the PHP test image), so a guidelines release cannot break it.
		stage('Verify guidelines') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'esoul-guidelines.json'
					changeset 'esoul-guidelines.lock'
					changeset 'docs/project_guidelines/**'
					changeset 'AGENTS.md'
					changeset 'CLAUDE.md'
					changeset 'Jenkinsfile'
				}
			}
			steps {
				withCredentials([string(credentialsId: env.SCALEWAY_REGISTRY_CREDENTIALS_ID, variable: 'SECRET')]) {
					dockerRegistryLogin(registryUrl: 'rg.fr-par.scw.cloud/testing-images', password: env.SECRET)
				}
				esoulGuidelinesCheck()
			}
			post {
				always {
					dockerRegistryLogout('rg.fr-par.scw.cloud/testing-images')
				}
			}
		}

		// The documentation tool: the Go installer, the wrapper and bootstrap scripts, the renderer image smoke test.
		stage('Verify tooling') {
			when {
				anyOf {
					buildingTag()
					triggeredBy 'TimerTrigger'
					expression { previousBuildFailed() }
					changeset 'tooling/project-tools/**'
					changeset 'tooling/install-project-tools/**'
					changeset 'tooling/project-templates/**'
					changeset 'tooling/scripts/*_project_tools'
					changeset 'tooling/scripts/tooling_version'
					changeset 'tooling/scripts/test_tooling_version'
					changeset 'tooling/scripts/test_bootstrap_*'
					changeset 'tooling/scripts/test_documentation_wrapper'
					changeset 'tooling/scripts/test_renderer_smoke'
					changeset 'install.sh'
					changeset 'Jenkinsfile'
				}
			}
			steps {
				sh 'tooling/scripts/test_tooling_version'
				sh 'tooling/scripts/test_bootstrap_manifest'
				sh 'tooling/scripts/test_documentation_wrapper'
				sh 'tooling/scripts/test_renderer_smoke'
				sh 'tooling/scripts/test_bootstrap_install'
			}
		}

		// Scheduled build only: a pinned third-party source (a `ref` in layers.json) with a newer release makes the build
		// unstable and names the source. Reading the upstream changes and bumping the ref stays a deliberate step.
		stage('Check upstream releases') {
			when {
				triggeredBy 'TimerTrigger'
			}
			steps {
				script {
					// returnStatus: the exit status of the check (1: newer release, anything else: could not run) is the result;
					// the report goes to the build log.
					def status = runCommandInTest(
						image: env.NODE_TEST_IMAGE,
						command: 'node tooling/scripts/check_upstream.mjs',
						returnStatus: true
					)
					if (status == 1) {
						unstable('A pinned upstream source has a newer release; see the report above.')
					} else if (status != 0) {
						error('The upstream check could not run; see the report above.')
					}
				}
			}
		}

		stage('Build and publish tooling images') {
			when {
				allOf {
					buildingTag()
					expression { env.PLUGIN_RELEASE != 'true' }
				}
			}

			steps {
				script {
					def version = env.DOCUMENTATION_TOOLS_VERSION
					def configSchemaVersion = '1'
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

					def publicationConfig = [
						githubRepository: env.GITHUB_REPOSITORY,
						releaseTag: version,
						sourceCommit: sourceCommit,
						releaseMetadata: [
							CONFIG_SCHEMA_VERSION: configSchemaVersion,
							UPGRADE_NOTES: env.UPGRADE_NOTES,
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
						publishRelease: false,
						requireExistingTag: true,
					]
					def draftArtifacts = publishContainerReleaseArtifacts(publicationConfig)
					if (!draftArtifacts.assets.containsKey('install.sh')) {
						error('Release draft is missing the install.sh bootstrap asset.')
					}
					def stagedBootstrap = readFile(file: 'build/release-artifacts/install.sh')
					if (stagedBootstrap != bootstrapScript) {
						error('Staged install.sh does not match the release-specific bootstrap.')
					}
					def stagedManifest = readFile(file: 'build/release-artifacts/release.env')
					def requiredManifestLine = "CONFIG_SCHEMA_VERSION=${configSchemaVersion}"
					if (!stagedManifest.readLines().contains(requiredManifestLine.toString())) {
						error("Release draft is missing ${requiredManifestLine}.")
					}
					def artifacts = publishContainerReleaseArtifacts(
						publicationConfig + [publishRelease: true]
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
			echo 'Pipeline completed successfully.'
		}
		unstable {
			echo 'Pipeline completed unstable: a pinned upstream source has a newer release (see the stage log).'
		}
		failure {
			echo 'Pipeline failed.'
		}
	}
}
