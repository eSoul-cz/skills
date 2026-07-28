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
		RENDERER_CONTEXT = 'assets/project-tools/docs/.documentation-tools/pdf'
		RENDERER_DOCKERFILE = 'assets/project-tools/docs/.documentation-tools/pdf/Dockerfile'
		VERSION_FILE = 'assets/project-tools/docs/.documentation-tools/VERSION'
		RELEASE_CATALOG_TOOL = 'assets/project-tools/docs/.documentation-tools/release-catalog'
	}

	stages {
		stage('Verify renderer') {
			steps {
				sh "${env.RELEASE_CATALOG_TOOL} validate"
				sh 'scripts/test_renderer_smoke'
				sh '''
					docker build \
						--file scripts/install-project-tools/Dockerfile \
						--tag documentation-tools-installer:test-${BUILD_NUMBER} \
						.
				'''
			}
		}

		stage('Build and publish renderer image') {
			when {
				anyOf {
					branch 'main'
					branch 'master'
				}
			}

			steps {
				withCredentials([string(credentialsId: 'scaleway_secret_key', variable: 'SECRET')]) {
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
						gitTags.each { tag ->
							if (tag ==~ /[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}/ && !buildTags.contains(tag)) {
								buildTags.add(tag)
							}
						}

						dockerRegistryLogin(
							registryUrl: env.REGISTRY_HOST,
							username: 'nologin',
							password: env.SECRET
						)
						def versionImage = "${env.REGISTRY}/${env.RENDERER_IMAGE}:${version}"
						def versionExists = sh(
							script: "if docker buildx imagetools inspect '${versionImage}' >/dev/null 2>&1; then echo yes; fi",
							returnStdout: true
						).trim()
						if (versionExists == 'yes') {
							error("Immutable renderer tag already exists: ${versionImage}. Bump VERSION before publishing.")
						}

						echo "Building and publishing renderer ${version} for amd64 and arm64..."
						dockerBuildMultiArch(
							registry: env.REGISTRY,
							registryHost: env.REGISTRY_HOST,
							registryPassword: env.SECRET,
							image: env.RENDERER_IMAGE,
							contextDir: env.RENDERER_CONTEXT,
							tags: buildTags,
							dockerfile: env.RENDERER_DOCKERFILE,
						)

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
						def releaseEntry = [
							'CATALOG_SCHEMA_VERSION=1',
							"RENDERER_VERSION=${version}",
							"RENDERER_IMAGE=${immutableImage}",
							'ARCHITECTURES=linux/amd64,linux/arm64',
							"PUBLISHED_AT=${publishedAt}",
							"SOURCE_COMMIT=${sourceCommit}",
							'CONFIG_SCHEMA_VERSION=1',
							'RELEASE_STATUS=active',
							'UPGRADE_NOTES=Adds named themes, eSoul client branding, project-local fonts, styled footnotes and callouts, configurable link notices, doctor diagnostics, and transactional hosted upgrades; configuration schema remains 1.',
							'SBOM=unavailable',
							'SCAN=unavailable',
							'PROVENANCE=unavailable',
							'SIGNATURE=unavailable',
							"DOCUMENTATION_RENDERER_VERSION=${version}",
							"DOCUMENTATION_REMOTE_RENDERER_IMAGE=${immutableImage}",
							''
						].join('\n')
						writeFile(
							file: "documentation-renderer-${version}.env",
							text: releaseEntry
						)
						writeFile(
							file: "release-catalog-candidate/${version}.env",
							text: releaseEntry
						)
						writeFile(
							file: 'release-catalog-candidate/LATEST',
							text: "${version}\n"
						)
						sh "DOCUMENTATION_RELEASE_CATALOG_DIR=release-catalog-candidate ${env.RELEASE_CATALOG_TOOL} validate"
						archiveArtifacts(
							artifacts: "documentation-renderer-${version}.env,release-catalog-candidate/*",
							allowEmptyArchive: false,
							fingerprint: true
						)
						echo "Published immutable renderer: ${immutableImage}"
						echo "Archive release-catalog-candidate/ in a reviewed follow-up commit to make this release durably resolvable."
					}
				}
			}
		}
	}

	post {
		always {
			sh '''
				version=$(sed -n '1p' "${VERSION_FILE}")
				docker image rm "esoul-documentation-tools:${version}-smoke" >/dev/null 2>&1 || true
				docker image rm "documentation-tools-installer:test-${BUILD_NUMBER}" >/dev/null 2>&1 || true
			'''
		}
		success {
			echo 'Documentation renderer pipeline completed successfully.'
		}
		failure {
			echo 'Documentation renderer pipeline failed.'
		}
	}
}
