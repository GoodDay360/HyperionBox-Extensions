import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL} from 'url'

const extension_manager = async (options) => {
	if (!options.source) {
		console.error("Missing 'source' key.");
		return {code:500, message: "Missing 'source' key."};
	}else{
		const source_path = pathToFileURL(path.join(options.BASE_DIRECTORY, "sources", options.source, 'main.js')).href;
		if (!existsSync(fileURLToPath(source_path))) {
			console.error("Source not exist!")
			return {code:500, error: "Source not exist!"}
		}
		else{
			const { default: main } = await import(source_path);
			return await main(options)
		}
	}
}
export default extension_manager;
