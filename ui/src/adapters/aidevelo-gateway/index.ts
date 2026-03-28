import type { UIAdapterModule } from "../types";
import { parseAideveloGatewayStdoutLine } from "@aideveloai/adapter-aidevelo-gateway/ui";
import { buildAideveloGatewayConfig } from "@aideveloai/adapter-aidevelo-gateway/ui";
import { aideveloGatewayConfigFields } from "./config-fields";

export const aideveloGatewayUIAdapter: UIAdapterModule = {
  type: "aidevelo_gateway",
  label: "Aidevelo Gateway",
  parseStdoutLine: parseAideveloGatewayStdoutLine,
  ConfigFields: aideveloGatewayConfigFields,
  buildAdapterConfig: buildAideveloGatewayConfig,
};
