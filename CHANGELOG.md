# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0.0] - 2026-10-12

### Added
- Bulk mode (`/bulk`): scan a local folder, sort images into wide and narrow, crop wide images one by one, pair narrow images into diptychs, and re-process any image from a gallery of results.
- Adjustable diptych gap (1–10% of the output width) in server mode and bulk mode.

### Changed
- The Flask dev server now binds to `127.0.0.1` instead of `0.0.0.0`.

### Fixed
- Bulk diptychs no longer come out distorted when image 1 loads slowly or is zoomed. Image 2's crop ratio now follows image 1's crop, and processing is blocked until the two match.
- Skip and Done are disabled while a wide image is processing, so an image can no longer be skipped unseen.
- Starting a new scan clears selections, open croppers and per-image status left over from the previous scan.
- A non-numeric `gap_percent` or `aspect_threshold`, or a non-string `folder_path`, returns a 400 instead of a server error.
- Non-JSON error responses are reported as server errors instead of "Network error: Unexpected token <".

### Security
- `/bulk/scan` only accepts requests from localhost, since it reads arbitrary server-side folders.
