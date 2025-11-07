export interface modrinthIndexFile {
    game: string;
    formatVersion: number;
    versionId: string;
    name: string;
    summary: string;
    files: Array<{
        path: string;
        hashes: {
            sha512: string;
            sha1: string;
        };
        env: {
            client: "required" | "optional" | "unsupported";
            server: "required" | "optional" | "unsupported";
        };
        downloads: Array<string>;
        fileSize: number;
    }>;
    dependencies: {
        minecraft?: string;
        forge?: string;
        neoforge?: string;
        "fabric-loader"?: string;
        "quilt-loader"?: string;
    };
}
