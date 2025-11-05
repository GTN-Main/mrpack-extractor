import fs from 'node:fs';
import { createZipReader } from '@holmlibs/unzip';
import https from 'node:https';

let mrpackPath: string | undefined = undefined;

if (process.argv[2] !== undefined) {
	if (
		!fs.existsSync(process.argv[2]) ||
		!process.argv[2].endsWith('.mrpack')
	) {
		console.error(
			'The provided path is invalid or does not point to a .mrpack file.'
		);
		process.exit(1);
	}
	mrpackPath = process.argv[2];
} else {
	while (!mrpackPath) {
		const input = prompt('Please provide the path to the .mrpack file:');
		if (input && fs.existsSync(input) && input.endsWith('.mrpack')) {
			mrpackPath = input;
		} else {
			console.log('Invalid path. Please try again.');
		}
	}
}

console.log(mrpackPath);

const zipPath = mrpackPath.replace('.mrpack', '.zip');

fs.copyFileSync(mrpackPath, zipPath);

console.log('File renamed to .zip successfully.');
const folderPath = mrpackPath.replace('.mrpack', '');

createZipReader(zipPath)
	.extractAll(folderPath)
	.then(async () => {
		console.log('Extraction completed successfully.');
		fs.unlinkSync(zipPath);
		const directories = fs.readdirSync(`${folderPath}/overrides`);

		directories.forEach((dir) => {
			fs.mkdirSync('.minecraft', { recursive: true });
			fs.renameSync(
				`${folderPath}/overrides/${dir}`,
				`.minecraft/${dir}`
			);
		});

		fs.rmdirSync(`${folderPath}/overrides/`);

		console.log('Files and directories moved to .minecraft/ folder successfully.');

        if (fs.existsSync(`${folderPath}/modrinth.index.json`)) {
			const files = JSON.parse(
				fs.readFileSync(`${folderPath}/modrinth.index.json`, 'utf-8')
			).files;
			files.forEach((file: any) => {
                if (!file.downloads[0]) return;
                if (!fs.existsSync(`.minecraft/${file.path.split('/').slice(0, -1).join('/')}`)) fs.mkdirSync(`.minecraft/${file.path.split('/').slice(0, -1).join('/')}`, { recursive: true });
				const stream = fs.createWriteStream(`.minecraft/${file.path}`);
				https.get(file.downloads[0], (response) => {
                    response.pipe(stream);
                    stream
                        .on("finish", () => {
                            stream.close(() => {
                                console.log(
                                    `File ${file.path.split("/").at(-1)} downloaded successfully`,
                                );
                            });
                        })
                        .on("error", (err: any) => {
                            fs.unlink(`.minecraft/${file.path}`, () => {
                                console.error(
                                    `Error downloading file ${file.path.split("/").at(-1)}:`,
                                    err,
                                );
                            });
                        });
                });
			});
			fs.unlinkSync(`${folderPath}/modrinth.index.json`);
			if (!fs.existsSync(`${folderPath}/overrides/`))
				fs.rmdirSync(folderPath);
		} else {
			console.log('No modrinth.index.json file found.');
			if (fs.existsSync(`${folderPath}/overrides/`))
				fs.rmdirSync(folderPath);
		}
	});
