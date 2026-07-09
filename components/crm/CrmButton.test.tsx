// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CrmButton } from "@/components/crm/CrmButton";

// Botão base reusado em todo o CRM — se quebrar no render, muitas telas quebram.
afterEach(cleanup);

describe("CrmButton", () => {
  it("renderiza o rótulo e é type=button por padrão", () => {
    render(<CrmButton>Salvar</CrmButton>);
    const b = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(b).toBeTruthy();
    expect(b.type).toBe("button");
  });

  it("dispara onClick uma vez", () => {
    const onClick = vi.fn();
    render(<CrmButton onClick={onClick}>Ir</CrmButton>);
    fireEvent.click(screen.getByRole("button", { name: "Ir" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled não dispara onClick e fica desabilitado", () => {
    const onClick = vi.fn();
    render(<CrmButton disabled onClick={onClick}>X</CrmButton>);
    const b = screen.getByRole("button", { name: "X" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading desabilita e marca aria-busy", () => {
    render(<CrmButton loading>Enviando</CrmButton>);
    const b = screen.getByRole("button") as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
  });

  it("aceita variante e classe extra sem quebrar", () => {
    render(<CrmButton variant="danger" className="extra-x">Excluir</CrmButton>);
    const b = screen.getByRole("button", { name: "Excluir" });
    expect(b.className).toContain("extra-x");
  });
});
