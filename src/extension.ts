import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tiktoken from 'tiktoken';
import ignore from 'ignore';

class RepoStructureCopier {
    private ig: ReturnType<typeof ignore> | null = null;

    async copyRepoStructure() {
        const rootPath = this.getRootPath();
        if (!rootPath) {
            return;
        }

        this.ig = await this.parseRepoIgnore(rootPath);

        // 1) construire l’arbre ASCII et collecter la liste des fichiers
        const treeLines: string[] = [];
        const files: string[] = [];
        await this.buildTree(rootPath, rootPath, '', treeLines, files);
        const tree = treeLines.join('\n');

        // 2) pour chaque fichier : lire, numéroter les lignes et encadrer
        const separator = '-'.repeat(80);
        const fileBlocks = await Promise.all(files.map(async filePath => {
            const rel = path.relative(rootPath, filePath);
            const content = await fs.readFile(filePath, 'utf8');
            const numbered = content
                .split(/\r?\n/)
                .map((line, i) => `${i + 1} | ${line}`)
                .join('\n');
            return `/${rel}:\n${separator}\n${numbered}\n${separator}`;
        }));

        // 3) concaténer et copier
        const structure = `${tree}\n\n${fileBlocks.join('\n\n')}`;
        const tokenCount = this.countTokens(structure);
        const formattedTokenCount = this.formatTokenCount(tokenCount);

        await vscode.env.clipboard.writeText(structure);
        vscode.window.showInformationMessage(`Repository structure copied to clipboard. Token count: ${formattedTokenCount}`);
    }

    private getRootPath(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return null;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    private async parseRepoIgnore(rootPath: string): Promise<ReturnType<typeof ignore>> {
        const ig = ignore();
        const repoignorePath = path.join(rootPath, '.repoignore');

        try {
            const repoignoreContent = await fs.readFile(repoignorePath, 'utf8');
            ig.add(repoignoreContent);
        } catch (error) {
            vscode.window.showWarningMessage('No .repoignore file found. No files will be ignored.');
        }

        return ig;
    }

    private shouldIgnore(filePath: string, rootPath: string): boolean {
        if (!this.ig) {
            return false;
        }
        const relativePath = path.relative(rootPath, filePath);
        return this.ig.ignores(relativePath);
    }

    /**
     * Parcourt récursivement `dir` en ordre alphabétique,
     * construit les lignes d’arbre dans `tree`,
     * et collecte les fichiers dans `files`.
     */
    private async buildTree(
        dir: string,
        rootPath: string,
        prefix: string,
        tree: string[],
        files: string[]
    ) {
        let entries = await fs.readdir(dir);
        entries = entries.sort();

        for (let i = 0; i < entries.length; i++) {
            const name = entries[i];
            const fullPath = path.join(dir, name);
            const rel = path.relative(rootPath, fullPath);
            if (this.shouldIgnore(fullPath, rootPath)) {
                continue;
            }

            const stat = await fs.stat(fullPath);
            const isLast = i === entries.length - 1;
            const branch = isLast ? '└── ' : '├── ';
            tree.push(prefix + branch + name);

            if (stat.isDirectory()) {
                const childPrefix = prefix + (isLast ? '    ' : '│   ');
                await this.buildTree(fullPath, rootPath, childPrefix, tree, files);
            } else {
                files.push(fullPath);
            }
        }
    }

    private countTokens(text: string): number {
        const encoding = tiktoken.encoding_for_model("gpt-4");
        const tokens = encoding.encode(text);
        encoding.free();
        return tokens.length;
    }

    private formatTokenCount(count: number): string {
        return count < 1000 ? count.toString() : `${(count / 1000).toFixed(1)}k`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const repoStructureCopier = new RepoStructureCopier();
    let disposable = vscode.commands.registerCommand(
        'extension.copyRepoStructure',
        () => repoStructureCopier.copyRepoStructure()
    );
    context.subscriptions.push(disposable);
}

export function deactivate() { }
