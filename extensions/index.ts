import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
	type ExtensionAPI,
	type ExtensionContext,
	getAgentDir,
} from "@mariozechner/pi-coding-agent";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

interface PiSettings {
	defaultProvider?: string;
	defaultModel?: string;
	defaultThinkingLevel?: ThinkingLevel;
}

interface SettingsMatch {
	directory: string;
	settingsPath: string;
	settings: PiSettings;
}

const STATUS_KEY = "model-scope";

function readSettings(settingsPath: string): PiSettings | undefined {
	try {
		return JSON.parse(readFileSync(settingsPath, "utf-8")) as PiSettings;
	} catch (error) {
		console.error(`[pi-model-scope] Failed to parse ${settingsPath}:`, error);
		return undefined;
	}
}

function hasScopedSettings(
	settings: PiSettings | undefined,
): settings is PiSettings {
	return Boolean(
		settings?.defaultProvider ||
			settings?.defaultModel ||
			settings?.defaultThinkingLevel,
	);
}

function loadGlobalSettings(): PiSettings {
	const settingsPath = path.join(getAgentDir(), "settings.json");
	if (!existsSync(settingsPath)) return {};
	return readSettings(settingsPath) ?? {};
}

function findNearestScopedSettings(
	startDir: string,
): SettingsMatch | undefined {
	const homeDir = path.resolve(homedir());
	let currentDir = path.resolve(startDir);

	while (true) {
		const settingsPath = path.join(currentDir, ".pi", "settings.json");
		if (existsSync(settingsPath)) {
			const settings = readSettings(settingsPath);
			if (hasScopedSettings(settings)) {
				return { directory: currentDir, settingsPath, settings };
			}
		}

		const parentDir = path.dirname(currentDir);
		if (currentDir === homeDir || currentDir === parentDir) {
			return undefined;
		}
		currentDir = parentDir;
	}
}

function buildEffectiveSettings(
	globalSettings: PiSettings,
	scopedSettings: PiSettings,
): PiSettings {
	return {
		defaultProvider:
			scopedSettings.defaultProvider ?? globalSettings.defaultProvider,
		defaultModel: scopedSettings.defaultModel ?? globalSettings.defaultModel,
		defaultThinkingLevel:
			scopedSettings.defaultThinkingLevel ??
			globalSettings.defaultThinkingLevel,
	};
}

function formatModel(
	provider: string | undefined,
	modelId: string | undefined,
): string {
	if (!provider && !modelId) return "no model";
	if (!provider) return modelId ?? "no model";
	return `${provider}/${modelId ?? "unknown"}`;
}

function updateStatus(
	ctx: ExtensionContext,
	match?: SettingsMatch,
	effectiveSettings?: PiSettings,
) {
	if (!match) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}

	const scopeName = path.basename(match.directory) || match.directory;
	const modelText = effectiveSettings?.defaultModel ?? "thinking only";
	ctx.ui.setStatus(STATUS_KEY, `📁 ${scopeName} · ${modelText}`);
}

async function applyScopedSettings(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	options: { notifyOnSuccess?: boolean; reason: string },
): Promise<void> {
	const match = findNearestScopedSettings(ctx.cwd);
	if (!match) {
		updateStatus(ctx, undefined);
		if (options.notifyOnSuccess) {
			ctx.ui.notify(
				`No ancestor .pi/settings.json with model settings found for ${ctx.cwd}`,
				"info",
			);
		}
		return;
	}

	const effectiveSettings = buildEffectiveSettings(
		loadGlobalSettings(),
		match.settings,
	);
	updateStatus(ctx, match, effectiveSettings);

	if (
		effectiveSettings.defaultThinkingLevel &&
		pi.getThinkingLevel() !== effectiveSettings.defaultThinkingLevel
	) {
		pi.setThinkingLevel(effectiveSettings.defaultThinkingLevel);
	}

	if (!effectiveSettings.defaultModel) {
		if (options.notifyOnSuccess) {
			ctx.ui.notify(
				`Applied scoped thinking level from ${match.settingsPath} (${effectiveSettings.defaultThinkingLevel ?? "unchanged"})`,
				"info",
			);
		}
		return;
	}

	const availableModels = await ctx.modelRegistry.getAvailable();
	let targetModel: (typeof availableModels)[number] | undefined;

	if (effectiveSettings.defaultProvider) {
		targetModel =
			availableModels.find(
				(model) =>
					model.provider === effectiveSettings.defaultProvider &&
					model.id === effectiveSettings.defaultModel,
			) ??
			ctx.modelRegistry.find(
				effectiveSettings.defaultProvider,
				effectiveSettings.defaultModel,
			);
		if (!targetModel) {
			ctx.ui.notify(
				`Scoped model ${formatModel(effectiveSettings.defaultProvider, effectiveSettings.defaultModel)} was not found`,
				"warning",
			);
			return;
		}
	} else {
		const matchingModels = availableModels.filter(
			(model) => model.id === effectiveSettings.defaultModel,
		);
		if (matchingModels.length === 1) {
			targetModel = matchingModels[0];
		} else if (matchingModels.length > 1) {
			ctx.ui.notify(
				`Scoped model ${effectiveSettings.defaultModel} is ambiguous. Set defaultProvider in ${match.settingsPath}.`,
				"warning",
			);
			return;
		} else {
			ctx.ui.notify(
				`Scoped model ${effectiveSettings.defaultModel} is unavailable. Set defaultProvider in ${match.settingsPath}.`,
				"warning",
			);
			return;
		}
	}

	const alreadySelected =
		ctx.model?.provider === targetModel.provider &&
		ctx.model?.id === targetModel.id;
	if (!alreadySelected) {
		const success = await pi.setModel(targetModel);
		if (!success) {
			ctx.ui.notify(
				`No API key is configured for scoped model ${targetModel.provider}/${targetModel.id}`,
				"warning",
			);
			return;
		}
	}

	if (options.notifyOnSuccess) {
		ctx.ui.notify(
			`Applied ${targetModel.provider}/${targetModel.id} from ${match.settingsPath} (${options.reason})`,
			"info",
		);
		return;
	}
}

export default function modelScopeExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		await applyScopedSettings(pi, ctx, { reason: "session start" });
	});

	pi.on("session_switch", async (_event, ctx) => {
		await applyScopedSettings(pi, ctx, { reason: "session switch" });
	});
}
