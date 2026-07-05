// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CrmCheckbox } from "@/components/crm/CrmCheckbox";

// Primeiro render test do repo — prova a rede da Fase 1.3.
// CrmCheckbox é um input compartilhado (reusado em vários drawers/listas);
// se ele quebrar no render, várias telas quebram junto. Estes testes rodam
// em happy-dom (ver docblock acima) e não tocam Supabase/router/context.

afterEach(cleanup);

describe("CrmCheckbox", () => {
  it("renderiza sem quebrar e expõe o aria-label como checkbox", () => {
    render(<CrmCheckbox checked={false} onChange={() => {}} aria-label="Selecionar tudo" />);
    const input = screen.getByRole("checkbox", { name: "Selecionar tudo" });
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).checked).toBe(false);
  });

  it("reflete checked=true no input", () => {
    render(<CrmCheckbox checked onChange={() => {}} aria-label="Item" />);
    expect((screen.getByRole("checkbox", { name: "Item" }) as HTMLInputElement).checked).toBe(true);
  });

  it("dispara onChange exatamente uma vez no clique", () => {
    const onChange = vi.fn();
    render(<CrmCheckbox checked={false} onChange={onChange} aria-label="Item" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Item" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("aplica o estado indeterminate no DOM quando indeterminate e !checked", () => {
    render(<CrmCheckbox checked={false} indeterminate onChange={() => {}} aria-label="Parcial" />);
    const input = screen.getByRole("checkbox", { name: "Parcial" }) as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });

  it("não fica indeterminate quando checked (checked vence)", () => {
    render(<CrmCheckbox checked indeterminate onChange={() => {}} aria-label="Cheio" />);
    const input = screen.getByRole("checkbox", { name: "Cheio" }) as HTMLInputElement;
    expect(input.indeterminate).toBe(false);
    expect(input.checked).toBe(true);
  });

  it("respeita disabled", () => {
    render(<CrmCheckbox checked={false} disabled onChange={() => {}} aria-label="Bloqueado" />);
    expect((screen.getByRole("checkbox", { name: "Bloqueado" }) as HTMLInputElement).disabled).toBe(true);
  });
});
