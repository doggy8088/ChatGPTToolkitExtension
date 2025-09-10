---
mode: agent
tools: ['codebase', 'editFiles', 'fetch']
---
I need to bump the minor version of my Chrome extension. Please help me with the following tasks:

1. **Update manifest.json**: Increment the minor version number (e.g., from "1.2.3" to "1.3.0")

2. **Update CHANGELOG.md**: Add a new entry for this version with:
    - Version number and release date
    - New features added
    - Bug fixes
    - Any breaking changes

3. **Additional version bump considerations**:
    - Update package.json version if it exists
    - Update any version references in documentation (README.md)
    - Update version in popup.html or options page if displayed
    - Check for hardcoded version strings in source code
    - Update any API version references if applicable
    - Consider updating extension description or screenshots if significant changes
    - Verify all new features are properly documented
    - Test the extension thoroughly before release
    - Tag the commit with the new version number
    - Update Chrome Web Store listing if needed

Please review the current version numbers and help me update all relevant files consistently.