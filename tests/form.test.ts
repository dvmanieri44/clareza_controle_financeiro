import { describe, expect, it } from "vitest";
import { createFormSchema, type FormField } from "@/lib/domain/form";

function validate(type: FormField["type"], value: string, extra: Partial<FormField> = {}) {
  return createFormSchema([{ key: "value", label: "Valor", type, ...extra }]).safeParse({ value });
}

describe("validação compartilhada dos formulários", () => {
  it("aponta o campo obrigatório que precisa ser corrigido", () => {
    const result = createFormSchema([{ key: "name", label: "Nome" }]).safeParse({ name: "  " });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: ["name"], message: "Preencha este campo." });
  });
  it("aceita campos opcionais ausentes ou vazios", () => {
    const schema = createFormSchema([{ key: "notes", label: "Observações", required: false }]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ notes: "" }).success).toBe(true);
  });
  it.each(["1,00", "0,01", "1.234,56"])("aceita valor positivo %s", value => expect(validate("money", value).success).toBe(true));
  it.each(["0,00", "-0,01", "abc", "12,345"])("rejeita o valor %s", value => expect(validate("money", value).success).toBe(false));
  it.each(["-1,00", "0,00", "1,00"])("aceita saldo com sinal %s", value => expect(validate("signedMoney", value).success).toBe(true));
  it("valida o calendário e a competência sem depender do navegador", () => {
    expect(validate("date", "2028-02-29").success).toBe(true);
    expect(validate("date", "2026-02-30").success).toBe(false);
    expect(validate("month", "2026-10").success).toBe(true);
    expect(validate("month", "2026-13").success).toBe(false);
  });
  it.each(["0", "32", "1.5", "abc"])("rejeita número fora dos limites %s", value => expect(validate("number", value, { min: 1, max: 31 }).success).toBe(false));
  it.each(["1", "31"])("aceita os limites inclusivos %s", value => expect(validate("number", value, { min: 1, max: 31 }).success).toBe(true));
  it("aplica os limites numéricos padrão", () => {
    expect(validate("number", "-1").success).toBe(false);
    expect(validate("number", "1000001").success).toBe(false);
    expect(validate("number", "0").success).toBe(true);
  });
  it("rejeita uma opção que não faz parte da lista", () => {
    const options = [{ value: "a", label: "Conta A" }];
    expect(validate("select", "a", { options }).success).toBe(true);
    expect(validate("select", "b", { options }).success).toBe(false);
    expect(validate("select", "a").success).toBe(false);
  });
  it("valida cores e os limites distintos de texto e observações", () => {
    expect(validate("color", "#167459").success).toBe(true);
    expect(validate("color", "red").success).toBe(false);
    expect(validate("text", "a".repeat(120)).success).toBe(true);
    expect(validate("text", "a".repeat(121)).success).toBe(false);
    expect(validate("textarea", "a".repeat(1000)).success).toBe(true);
    expect(validate("textarea", "a".repeat(1001)).success).toBe(false);
  });
  it("não permite usar uma categoria de despesa ao mudar para receita", () => {
    const schema = createFormSchema([{ key: "kind", label: "Tipo", type: "select", options: [{ value: "income", label: "Receita" }, { value: "expense", label: "Despesa" }] }, { key: "category", label: "Categoria", type: "select", options: [{ value: "salary", label: "Salário", when: { field: "kind", value: "income" } }, { value: "food", label: "Alimentação", when: { field: "kind", value: "expense" } }] }]);
    expect(schema.safeParse({ kind: "income", category: "salary" }).success).toBe(true);
    expect(schema.safeParse({ kind: "expense", category: "food" }).success).toBe(true);
    expect(schema.safeParse({ kind: "income", category: "food" }).success).toBe(false);
  });
});
