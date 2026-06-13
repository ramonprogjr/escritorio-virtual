import { describe, expect, it } from "vitest";
import { sugerirMenuTypeUazapi, UAZAPI_MENU_BUTTON_MAX_OPCOES } from "./menu-type-uazapi";

describe("sugerirMenuTypeUazapi", () => {
  it("usa button para até 3 opções", () => {
    expect(sugerirMenuTypeUazapi(1)).toBe("button");
    expect(sugerirMenuTypeUazapi(3)).toBe("button");
  });

  it("usa list para 4 ou mais opções", () => {
    expect(sugerirMenuTypeUazapi(4)).toBe("list");
    expect(sugerirMenuTypeUazapi(6)).toBe("list");
  });

  it("respeita preferência list", () => {
    expect(sugerirMenuTypeUazapi(2, "list")).toBe("list");
  });

  it("downgrade button para list se opções excedem limite", () => {
    expect(sugerirMenuTypeUazapi(5, "button")).toBe("list");
    expect(UAZAPI_MENU_BUTTON_MAX_OPCOES).toBe(3);
  });

  it("mantém text só para simulação CRM", () => {
    expect(sugerirMenuTypeUazapi(6, "text")).toBe("text");
  });
});
