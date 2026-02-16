import { execFile } from "node:child_process";
import * as os from "node:os";

export function openUrl(url: string, browser?: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const platform = os.platform();
		let cmd: string;
		let args: string[];

		if (platform === "darwin") {
			cmd = "open";
			args = browser ? ["-a", browser, url] : [url];
		} else if (platform === "win32") {
			cmd = "cmd";
			args = browser ? ["/c", "start", "", browser, url] : ["/c", "start", "", url];
		} else {
			cmd = browser ?? "xdg-open";
			args = [url];
		}

		execFile(cmd, args, (err) => {
			if (err) {
				reject(new Error(err.message || `Failed to open browser (${cmd})`));
			} else {
				resolve();
			}
		});
	});
}
