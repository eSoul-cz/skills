package main

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

var supportedFontExtensions = map[string]bool{
	".otc": true,
	".otf": true,
	".ttc": true,
	".ttf": true,
}

func resolveFontDirectories(root string, configured []string) ([]string, error) {
	directories := make([]string, 0, len(configured))
	seen := make(map[string]bool, len(configured))
	for _, value := range configured {
		if strings.TrimSpace(value) == "" {
			return nil, fmt.Errorf("pdf.font_dirs entries must be non-empty project paths")
		}
		directory, err := securePath(root, value)
		if err != nil {
			return nil, fmt.Errorf("pdf.font_dirs: %w", err)
		}
		info, err := os.Stat(directory)
		if err != nil || !info.IsDir() {
			return nil, fmt.Errorf("pdf.font_dirs entry is not a directory: %s", value)
		}
		resolved, err := filepath.EvalSymlinks(directory)
		if err != nil {
			return nil, fmt.Errorf("resolve pdf.font_dirs entry %s: %w", value, err)
		}
		if seen[resolved] {
			continue
		}
		hasFont, err := directoryContainsFont(root, resolved)
		if err != nil {
			return nil, fmt.Errorf("inspect pdf.font_dirs entry %s: %w", value, err)
		}
		if !hasFont {
			return nil, fmt.Errorf(
				"pdf.font_dirs entry contains no supported .otf, .ttf, .otc, or .ttc files: %s",
				value,
			)
		}
		seen[resolved] = true
		directories = append(directories, resolved)
	}
	return directories, nil
}

func directoryContainsFont(root, directory string) (bool, error) {
	hasFont := false
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return false, err
	}
	err = filepath.WalkDir(directory, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			resolved, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}
			if !inside(resolvedRoot, resolved) {
				return fmt.Errorf("font path escapes project root through a symbolic link: %s", path)
			}
		}
		if !entry.IsDir() && supportedFontExtensions[strings.ToLower(filepath.Ext(path))] {
			hasFont = true
		}
		return nil
	})
	return hasFont, err
}

func prepareFontEnvironment(root, stagingDir string, configured []string) ([]string, error) {
	directories, err := resolveFontDirectories(root, configured)
	if err != nil {
		return nil, err
	}
	if len(directories) == 0 {
		return nil, nil
	}

	var config bytes.Buffer
	config.WriteString(`<?xml version="1.0"?>` + "\n")
	config.WriteString(`<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">` + "\n")
	config.WriteString("<fontconfig>\n")
	for _, directory := range directories {
		config.WriteString("  <dir>")
		if err := xml.EscapeText(&config, []byte(directory)); err != nil {
			return nil, fmt.Errorf("encode local font directory: %w", err)
		}
		config.WriteString("</dir>\n")
	}
	config.WriteString(`  <include ignore_missing="no">/etc/fonts/fonts.conf</include>` + "\n")
	config.WriteString("</fontconfig>\n")

	path := filepath.Join(stagingDir, "documentation-fontconfig.conf")
	if err := os.WriteFile(path, config.Bytes(), 0o600); err != nil {
		return nil, fmt.Errorf("write local font configuration: %w", err)
	}
	return []string{"FONTCONFIG_FILE=" + path}, nil
}
