import { Injectable } from "@angular/core";

import { LoggerService } from "../logger/logger.service";

@Injectable({
	providedIn: "root"
})
export class FormatService {
	
	logType = "[Service]";
	logName = "[Format]";

	constructor(
		private logger: LoggerService,
	) {
		this.logger.info(`${this.logType} ${this.logName} constructor`);
	}

	/**
	 * Formats Bytes
	 * 
	 * @param bytes 
	 * @param decimals 
	 */
	formatBytes(bytes, decimals = 2) {
		if (bytes === 0) return "0 Bytes";

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
	}

	/**
	 * Formats Bits per second
	 * 
	 * @param bits
	 * @param decimals 
	 */
	formatBytesPerSecond(bytes, decimals = 2) {
		if (bytes === 0) return "0 Bps";

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["Bps", "KBps", "MBps", "GBps", "TBps", "PBps", "EBps", "ZBps", "YBps"];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
	}


	/**
	 * Formats Bits
	 * 
	 * @param bits
	 * @param decimals 
	 */
	formatBits(bits, decimals = 2) {
		if (bits === 0) return "0 bits";

		const k = 1000;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["bits", "Kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb"];

		const i = Math.floor(Math.log(bits) / Math.log(k));

		return parseFloat((bits / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
	}

	/**
	 * Formats Bits per second
	 * 
	 * @param bits
	 * @param decimals 
	 */
	formatBitsPerSecond(bits, decimals = 2) {
		if (bits === 0) return "0 bps";

		const k = 1000;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["bps", "Kbps", "Mbps", "Gbps", "Tbps", "Pbps", "Ebps", "Zbps", "Ybps"];

		const i = Math.floor(Math.log(bits) / Math.log(k));

		return parseFloat((bits / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
	}

	formatUnixtime(time) {
		return (new Date(time * 1000)).toISOString();
	}

	formatUptime(time) {
		const date = new Date(time * 1000);
		const hours = date.getUTCHours();
		const minutes = date.getUTCMinutes();
		const seconds = date.getUTCSeconds();

		return hours.toString().padStart(2, "0") + ":" +
			minutes.toString().padStart(2, "0") + ":" +
			seconds.toString().padStart(2, "0");
	}
}
