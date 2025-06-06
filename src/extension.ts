import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tiktoken from 'tiktoken';
import ignore from 'ignore';

class RepoStructureCopier {
    private ig: ReturnType<typeof ignore> | null = null;

    /** Extensions que l’on souhaite systématiquement exclure du contenu */
    private excludedExtensions: Set<string> = new Set([
        // Images
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tiff', '.webp',
        // Polices
        '.woff', '.woff2', '.ttf', '.otf', '.eot',
        // Audio
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',
        // Vidéo
        '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.webm', '.flv',
        // Archives
        '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz',
        // Documents binaires
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        // Binaires / bytecode
        '.exe', '.dll', '.so', '.bin', '.class', '.jar'
    ]);

    /** Noms de fichiers/dossiers à inclure dans la liste .repoignore par défaut */
    private excludedNames: Set<string> = new Set([
        '.git',
        '.gitignore',
        '.gitmodules',
        '.repoignore',
        'node_modules',
        'dist',
        'build',
        'out',
        'coverage',
        '__pycache__',
        '.idea',
        '.vscode',
        '.DS_Store',
        'Thumbs.db',
        'desktop.ini',
        '.env',
        '.env.local',
        '.env.*',
        '*.log',
        '*.log.*',
        'npm-debug.log*',
        'yarn-debug.log*',
        'pnpm-debug.log*',
        '*.tmp',
        '*.bak',
        '*~',
        '*.swp',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '*.lock',
        '.cache',
        '.eslintcache',
        '.next',
        '.nuxt',
        '.parcel-cache',
        '.serverless',
        '.history',
        'public/build'
    ]);

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
            const lines = content.split(/\r?\n/);
            const width = String(lines.length).length;
            const numbered = lines
                .map((line, i) => `${String(i + 1).padStart(width, ' ')} | ${line}`)
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

        // exclusions par défaut
        ig.add(['.git', '.DS_Store']);

        const repoignorePath = path.join(rootPath, '.repoignore');
        try {
            // Si .repoignore existe, on l'ajoute
            const repoignoreContent = await fs.readFile(repoignorePath, 'utf8');
            ig.add(repoignoreContent);
        } catch {
            // Sinon, on le crée avec les valeurs de excludedNames
            const defaultIgnore = Array.from(this.excludedNames).join('\n') + '\n';
            await fs.writeFile(repoignorePath, defaultIgnore, 'utf8');
            ig.add(defaultIgnore);
            vscode.window.showInformationMessage('Created .repoignore with default entries.');

            // Ajouter .repoignore dans .gitignore
            const gitignorePath = path.join(rootPath, '.gitignore');
            try {
                let gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
                if (!gitignoreContent.includes('.repoignore')) {
                    if (!gitignoreContent.endsWith('\n')) {
                        gitignoreContent += '\n';
                    }
                    gitignoreContent += '.repoignore\n';
                    await fs.writeFile(gitignorePath, gitignoreContent, 'utf8');
                }
            } catch {
                // Pas de .gitignore ? On le crée juste avec .repoignore
                await fs.writeFile(gitignorePath, '.repoignore\n', 'utf8');
            }
            vscode.window.showInformationMessage('Added .repoignore to .gitignore.');
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
     * construit les lignes d’arborescence dans `treeLines`,
     * et collecte dans `files` uniquement les fichiers non exclus.
     */
    private async buildTree(
        dir: string,
        rootPath: string,
        prefix: string,
        treeLines: string[],
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
            const ext = path.extname(name).toLowerCase();
            const isLast = i === entries.length - 1;
            const branch = isLast ? '└── ' : '├── ';

            // Toujours afficher dans l’arborescence
            treeLines.push(prefix + branch + name);

            if (stat.isDirectory()) {
                const childPrefix = prefix + (isLast ? '    ' : '│   ');
                await this.buildTree(fullPath, rootPath, childPrefix, treeLines, files);
            } else {
                // Ajouter aux fichiers si non exclus
                if (!this.excludedExtensions.has(ext)) {
                    files.push(fullPath);
                }
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
