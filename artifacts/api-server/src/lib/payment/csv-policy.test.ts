import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./csv-policy";

describe("CSV export policy", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\t=cmd", "\r=cmd"])(
    "neutralizes spreadsheet formula input %j",
    (value) => {
      const neutralized = `'${value}`;
      const expected = /[,"\r\n]/u.test(neutralized)
        ? `"${neutralized.replace(/"/gu, '""')}"`
        : neutralized;
      expect(escapeCsvCell(value)).toBe(expected);
    },
  );

  it("quotes commas, quotes, and newlines after neutralization", () => {
    expect(escapeCsvCell('=HYPERLINK("https://example.test", "x")'))
      .toBe('"\'=HYPERLINK(""https://example.test"", ""x"")"');
  });

  it("keeps normal values unchanged", () => {
    expect(escapeCsvCell("normal text")).toBe("normal text");
    expect(escapeCsvCell(null)).toBe("");
  });
});
