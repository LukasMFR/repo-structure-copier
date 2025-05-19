# Repository Structure Copier

> 🛠️ Fork maintained by **Lukas Mauffré**  
> This is a personal fork of the original [repo-structure-copier](https://github.com/niels-hop/repo-structure-copier), with updated packaging and publishing setup.

---

## 📚 Table of Contents

- [Features](#features)
- [Usage](#usage)
- [.repoignore](#repoignore)
- [Token Count](#token-count)
- [Requirements](#requirements)
- [Extension Settings](#extension-settings)
- [Known Issues](#known-issues)
- [Tutorial (Install Manually)](#tutorial-install-manually)

---

## Features

- Copies the entire structure of your repository to the clipboard
- Includes file contents in the copied structure
- Respects `.repoignore` rules for excluding files and directories
- Provides a token count for the copied structure

## Usage

1. Open a repository in VS Code
2. Use the keyboard shortcut:
   - Windows: `Ctrl+Alt+C`
   - macOS: `Cmd+Alt+C`
3. Alternatively, you can:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
   - Type "Copy Repository Structure" and select the command
4. The repository structure will be copied to your clipboard, and you'll see a notification with the token count

## .repoignore

Create a `.repoignore` file in the root of your repository to specify files and directories to exclude. The syntax is similar to `.gitignore`.

Example `.repoignore`:

```
node_modules
*.log
.vscode
```

If no `.repoignore` file is found, a warning will be shown, and no files will be ignored.

## Token Count

The extension provides a token count for the copied structure, which can be useful for estimating usage with large language models. The count is displayed in the notification after copying.

## Requirements

- Visual Studio Code 1.60.0 or higher

## Extension Settings

This extension does not add any VS Code settings.

## Known Issues

- Large repositories may take some time to process
- Very large files might cause performance issues

---

## 📦 Tutorial (Install Manually)

If you want to install this forked version manually:

### 1. Clone the repository

```bash
git clone https://github.com/lukasmfr/repo-structure-copier.git
cd repo-structure-copier
````

### 2. Install dependencies

```bash
npm install
```

### 3. Build and package the extension

```bash
vsce package
```

> This will generate a file like `repo-structure-copier-lukas-1.0.X.vsix`
> (where `X` is the current version number)

### 4. Install the extension in VS Code

```bash
code --install-extension repo-structure-copier-lukas-1.0.X.vsix
```

---

**Enjoy!**