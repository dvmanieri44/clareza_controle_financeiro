import { describe, expect, it } from "vitest";
import { readableTextColor } from "@/lib/accessibility";

describe("contraste de texto em cartões de cor personalizada", () => {
  it.each(["#ffffff", "#FFFF00", "#00ff00", "#ff0000", "#777777"])("usa texto preto no fundo %s", value => expect(readableTextColor(value)).toBe("#000000"));
  it.each(["#000000", "#0000ff", "#167459", "#111a17"])("usa texto branco no fundo %s", value => expect(readableTextColor(value)).toBe("#ffffff"));
  it.each(["", "red", "#fff", "#gggggg"])("usa uma alternativa segura para cor inválida %s", value => expect(readableTextColor(value)).toBe("#000000"));
});
