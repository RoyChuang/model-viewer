export interface ViewerModelConfig {
  id: string;
  label: string;
}

export interface LabRackModelConfig {
  modelId: string;
  modelRotationY?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseViewerModelsConfig(value: unknown): ViewerModelConfig[] {
  if (!Array.isArray(value)) {
    throw new Error("viewer-models config must be an array");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`viewer-models[${index}] must be an object`);
    }

    if (typeof item.id !== "string" || item.id.length === 0) {
      throw new Error(`viewer-models[${index}].id must be a string`);
    }

    if (typeof item.label !== "string" || item.label.length === 0) {
      throw new Error(`viewer-models[${index}].label must be a string`);
    }

    return {
      id: item.id,
      label: item.label,
    };
  });
}

export function parseLabRacksConfig(value: unknown): Record<string, LabRackModelConfig> {
  if (!isRecord(value)) {
    throw new Error("lab-racks config must be an object");
  }

  const config: Record<string, LabRackModelConfig> = {};

  for (const [rackId, item] of Object.entries(value)) {
    if (!isRecord(item)) {
      throw new Error(`lab-racks.${rackId} must be an object`);
    }

    if (typeof item.modelId !== "string" || item.modelId.length === 0) {
      throw new Error(`lab-racks.${rackId}.modelId must be a string`);
    }

    if (item.rotationY !== undefined && typeof item.rotationY !== "number") {
      throw new Error(`lab-racks.${rackId}.rotationY must be a number`);
    }

    config[rackId] = {
      modelId: item.modelId,
      modelRotationY: item.rotationY,
    };
  }

  return config;
}
