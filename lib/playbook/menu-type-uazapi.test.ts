import { describe, expect, it } from "vitest";
import {
  sugerirMenuTypeUazapi,
  UAZAPI_MENU_LIST_MIN_OPCOES,
} from "./menu-type-uazapi";

describe("sugerirMenuTypeUazapi", () => {
  it("usa button para até 8 opções", () => {
    expect(sugerirMenuTypeUazapi(1)).toBe("button");
    expect(sugerirMenuTypeUazapi(6)).toBe("button");
    expect(sugerirMenuTypeUazapi(8)).toBe("button");
  });

  it("usa list para 9 ou mais opções", () => {
    expect(sugerirMenuTypeUazapi(9)).toBe("list");
    expect(sugerirMenuTypeUazapi(12)).toBe("list");
    expect(UAZAPI_MENU_LIST_MIN_OPCOES).toBe(9);
  });

  it("força button se playbook pedir list com menos de 9 opções", () => {
    expect(sugerirMenuTypeUazapi(6, "list")).toBe("button");
    expect(sugerirMenuTypeUazapi(4, "button")).toBe("button");
  });

  it("mantém text só para simulação CRM", () => {
    expect(sugerirMenuTypeUazapi(12, "text")).toBe("text");
  });
});
