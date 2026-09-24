export function computerProxyEnv(
  computer: { boxId?: string; token?: string; control?: { url: string; token: string } },
): NodeJS.ProcessEnv {
  return {
    OGB_BOX_ID: computer.boxId ?? "",
    OGB_BOX_TOKEN: computer.token ?? "",
    ...(computer.control
      ? { KIND_MEITNER_CONTROL_URL: computer.control.url, KIND_MEITNER_CONTROL_TOKEN: computer.control.token }
      : {}),
  };
}
