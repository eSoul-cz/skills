package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

var immutableImagePattern = regexp.MustCompile(`^[^\s@]+@sha256:[0-9a-f]{64}$`)
var sectionPattern = regexp.MustCompile(`^\s*\[([^\[\]]+)\]\s*(?:#.*)?$`)
var arraySectionPattern = regexp.MustCompile(`^\s*\[\[([^\[\]]+)\]\]\s*(?:#.*)?$`)
var rootSchemaPattern = regexp.MustCompile(`^\s*schema_version\s*=\s*([1-9][0-9]*)\s*(?:#.*)?$`)
var pdfModePattern = regexp.MustCompile(`^\s*mode\s*=\s*"([^"\\]*)"\s*(?:#.*)?$`)
var pdfImagePattern = regexp.MustCompile(`^\s*image\s*=\s*"([^"\\]*)"\s*(?:#.*)?$`)

type projectConfig struct {
	SchemaVersion int
	PDFMode       string
	PDFImage      string
}

func readProjectConfig(projectRoot string) (projectConfig, error) {
	configPath, err := managedTarget(projectRoot, "docs/documentation.toml")
	if err != nil {
		return projectConfig{}, err
	}
	input, err := os.Open(configPath)
	if err != nil {
		return projectConfig{}, fmt.Errorf("read project documentation configuration: %w", err)
	}
	defer input.Close()

	var config projectConfig
	var section string
	var schemaFound, modeFound, imageFound bool
	scanner := bufio.NewScanner(input)
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if match := sectionPattern.FindStringSubmatch(line); match != nil {
			section = strings.TrimSpace(match[1])
			continue
		}
		if match := arraySectionPattern.FindStringSubmatch(line); match != nil {
			section = strings.TrimSpace(match[1])
			continue
		}
		if section == "" && hasAssignmentForKey(trimmed, "schema_version") {
			match := rootSchemaPattern.FindStringSubmatch(line)
			if match == nil || schemaFound {
				return projectConfig{}, errors.New("documentation.toml schema_version must be one positive integer")
			}
			config.SchemaVersion, err = strconv.Atoi(match[1])
			if err != nil {
				return projectConfig{}, fmt.Errorf("parse documentation.toml schema_version: %w", err)
			}
			schemaFound = true
			continue
		}
		if section != "pdf" {
			continue
		}
		switch {
		case hasAssignmentForKey(trimmed, "mode"):
			match := pdfModePattern.FindStringSubmatch(line)
			if match == nil || modeFound {
				return projectConfig{}, errors.New(`documentation.toml [pdf].mode must be one simple quoted string`)
			}
			config.PDFMode = match[1]
			modeFound = true
		case hasAssignmentForKey(trimmed, "image"):
			match := pdfImagePattern.FindStringSubmatch(line)
			if match == nil || imageFound {
				return projectConfig{}, errors.New(`documentation.toml [pdf].image must be one simple quoted string`)
			}
			config.PDFImage = match[1]
			imageFound = true
		}
	}
	if err := scanner.Err(); err != nil {
		return projectConfig{}, fmt.Errorf("read project documentation configuration: %w", err)
	}
	if !schemaFound {
		return projectConfig{}, errors.New("documentation.toml is missing root schema_version")
	}
	if !modeFound {
		return projectConfig{}, errors.New("documentation.toml is missing [pdf].mode")
	}
	if !imageFound {
		return projectConfig{}, errors.New("documentation.toml is missing [pdf].image")
	}
	if config.PDFMode != "local" && config.PDFMode != "remote" {
		return projectConfig{}, fmt.Errorf(`documentation.toml [pdf].mode must be "local" or "remote", got %q`, config.PDFMode)
	}
	if config.PDFMode == "remote" && !immutableImagePattern.MatchString(config.PDFImage) {
		return projectConfig{}, errors.New("documentation.toml remote [pdf].image must be pinned by an immutable sha256 digest")
	}
	return config, nil
}

func hasAssignmentForKey(trimmed, key string) bool {
	if !strings.HasPrefix(trimmed, key) {
		return false
	}
	remainder := strings.TrimSpace(strings.TrimPrefix(trimmed, key))
	return strings.HasPrefix(remainder, "=")
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func planRemoteProfileUpgrade(
	projectRoot,
	assetRoot,
	targetVersion,
	targetImage string,
	targetConfigSchema int,
	displayProjectRoot string,
) error {
	info, err := os.Stat(projectRoot)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("project root does not exist: %s", projectRoot)
	}
	if _, ok := parseSemanticVersion(targetVersion); !ok {
		return fmt.Errorf("target renderer version is not semantic: %q", targetVersion)
	}
	if !immutableImagePattern.MatchString(targetImage) {
		return errors.New("target renderer image is not pinned by an immutable sha256 digest")
	}
	if displayProjectRoot == "" {
		displayProjectRoot = projectRoot
	}
	if strings.ContainsAny(displayProjectRoot, "\r\n") {
		return errors.New("display project root must not contain a line break")
	}
	version, err := bundledVersion(assetRoot)
	if err != nil {
		return err
	}
	if version != targetVersion {
		return fmt.Errorf(
			"catalog release %s does not match bundled managed tooling %s; use the skill revision published for the target release",
			targetVersion,
			version,
		)
	}
	existing, err := loadManifest(projectRoot)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("documentation tooling is not installed; install it before planning an upgrade")
	}
	installedVersion, installedOK := parseSemanticVersion(existing.ToolVersion)
	targetSemanticVersion, _ := parseSemanticVersion(targetVersion)
	if !installedOK {
		return fmt.Errorf("installed managed tool version is not semantic: %q", existing.ToolVersion)
	}
	if compareVersions(installedVersion, targetSemanticVersion) > 0 {
		return fmt.Errorf("refusing to plan a downgrade from %s to %s", existing.ToolVersion, targetVersion)
	}
	profile := existing.InstallProfile
	if profile == "" {
		profile = "local"
	}
	if profile != "local" && profile != "remote" {
		return fmt.Errorf("installed manifest has unsupported install_profile %q", profile)
	}
	config, err := readProjectConfig(projectRoot)
	if err != nil {
		return err
	}
	if config.SchemaVersion != targetConfigSchema {
		return fmt.Errorf(
			"documentation.toml schema_version %d is incompatible with release %s, which requires schema %d",
			config.SchemaVersion,
			targetVersion,
			targetConfigSchema,
		)
	}
	files, err := sourceFiles(assetRoot, "remote")
	if err != nil {
		return err
	}
	retired, err := prepareExistingInstall(projectRoot, *existing, files)
	if err != nil {
		return err
	}

	retained := 0
	for relative := range files {
		if _, managed := existing.ManagedFiles[relative]; managed {
			retained++
		}
	}
	fmt.Println("Documentation tooling remote-upgrade plan")
	fmt.Printf("Project: %s\n", displayProjectRoot)
	fmt.Printf("Installed managed tooling: %s (%s profile)\n", existing.ToolVersion, profile)
	fmt.Printf("Target managed tooling: %s (remote profile)\n", targetVersion)
	fmt.Printf("Target renderer: %s\n", targetImage)
	fmt.Printf("Configuration schema: %d (compatible)\n", targetConfigSchema)
	fmt.Printf("Managed files: %d retained or replaced, %d added, %d retired\n", retained, len(files)-retained, len(retired))
	fmt.Println("Project configuration changes:")
	fmt.Printf("- docs/documentation.toml [pdf].mode: %q -> %q\n", config.PDFMode, "remote")
	fmt.Printf("- docs/documentation.toml [pdf].image: %q -> %q\n", config.PDFImage, targetImage)
	fmt.Println("Trusted runtime configuration:")
	fmt.Printf("- DOCUMENTATION_REMOTE_RENDERER_IMAGE=%s\n", targetImage)
	fmt.Println("Managed tooling migration:")
	fmt.Printf("- scripts/install_project_tools %s --upgrade --remote\n", shellQuote(displayProjectRoot))
	if len(retired) > 0 {
		fmt.Println("Retired managed files:")
		for _, relative := range retired {
			fmt.Printf("- %s\n", relative)
		}
	}
	fmt.Println("No files were changed. Apply support is not enabled by this planner.")
	return nil
}
