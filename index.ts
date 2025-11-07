import fs from "node:fs";
import { createZipReader } from "@holmlibs/unzip";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import type { modrinthIndexFile } from "./types.js";

let mrpackPath: string | undefined = undefined;

if (process.argv[2] !== undefined) {
    if (
        !fs.existsSync(process.argv[2]) ||
        !process.argv[2].endsWith(".mrpack")
    ) {
        console.error(
            "The provided path is invalid or does not point to a .mrpack file.",
        );
        process.exit(1);
    }
    mrpackPath = process.argv[2];
} else {
    while (!mrpackPath) {
        const input = prompt("Please provide the path to the .mrpack file:");
        if (input && fs.existsSync(input) && input.endsWith(".mrpack")) {
            mrpackPath = input;
        } else {
            console.log("Invalid path. Please try again.");
        }
    }
}

console.log(mrpackPath);

const tempDir = os.tmpdir();
const fileName = path.basename(mrpackPath, ".mrpack");
const zipPath = path.join(tempDir, `${fileName}.zip`);
const folderPath = path.join(tempDir, fileName);

fs.copyFileSync(mrpackPath, zipPath);

console.log("File copied to temp directory successfully.");

async function downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(
                        new Error(`Failed to download: ${response.statusCode}`),
                    );
                    return;
                }
                const stream = fs.createWriteStream(destination);
                response.pipe(stream);
                stream.on("finish", () => {
                    stream.close();
                    resolve();
                });
                stream.on("error", (err) => {
                    fs.unlink(destination, () => {});
                    reject(err);
                });
            })
            .on("error", reject);
    });
}

createZipReader(zipPath)
    .extractAll(folderPath)
    .then(async () => {
        console.log("Extraction completed successfully.");
        fs.unlinkSync(zipPath);

        const minecraftDir = path.join(process.cwd(), ".minecraft");
        const overridesPath = path.join(folderPath, "overrides");

        if (fs.existsSync(overridesPath)) {
            if (!fs.existsSync(minecraftDir)) {
                fs.mkdirSync(minecraftDir, { recursive: true });
            }

            fs.cpSync(overridesPath, minecraftDir, { recursive: true });

            fs.rmSync(overridesPath, { recursive: true, force: true });
        }

        console.log(
            "Files and directories moved to .minecraft/ folder successfully.",
        );

        if (fs.existsSync(`${folderPath}/modrinth.index.json`)) {
            const modrinthIndex: modrinthIndexFile = JSON.parse(
                fs.readFileSync(`${folderPath}/modrinth.index.json`, "utf-8"),
            );
            const files = modrinthIndex.files;

            const downloadPromises = files.map(async (file) => {
                if (!file.downloads[0]) return;

                const filePath = `.minecraft/${file.path}`;
                const dirPath = `.minecraft/${file.path.split("/").slice(0, -1).join("/")}`;

                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                try {
                    await downloadFile(file.downloads[0], filePath);
                    console.log(
                        `File ${file.path.split("/").at(-1)} downloaded successfully`,
                    );
                } catch (err) {
                    console.error(
                        `Error downloading file ${file.path.split("/").at(-1)}:`,
                        err,
                    );
                }
            });

            await Promise.all(downloadPromises);

            fs.unlinkSync(`${folderPath}/modrinth.index.json`);
            if (fs.readdirSync(folderPath).length === 0) {
                fs.rmdirSync(folderPath);
            } else {
                console.warn(
                    `Some files remained in the folder:\n\t${fs.readdirSync(folderPath).join("\n\t")}`,
                );
            }
        } else {
            console.log("No modrinth.index.json file found.");
            if (fs.readdirSync(folderPath).length === 0) {
                fs.rmdirSync(folderPath);
            } else {
                console.warn(
                    `Some files remained in the folder:\n\t${fs.readdirSync(folderPath).join("\n\t")}`,
                );
            }
        }
    })
    .catch((err) => {
        console.error("An error occurred:", err);
        process.exit(1);
    });
