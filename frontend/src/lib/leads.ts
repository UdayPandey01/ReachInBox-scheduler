const EMAIL_CANDIDATE = /[^\s,;:"'<>()[\]]+@[^\s,;:"'<>()[\]]+/g;

const VALID_EMAIL =
  /^(?!\.)(?!.*\.\.)[a-z0-9_'+\-.]*[a-z0-9_+-]@([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/;

export function parseLeads(text: string) {
  const candidates = (text.match(EMAIL_CANDIDATE) ?? []).map((candidate) =>
    candidate.toLowerCase().replace(/\.+$/, ""),
  );

  const unique = [...new Set(candidates)];

  return {
    valid: unique.filter((email) => VALID_EMAIL.test(email)),
    invalid: unique.filter((email) => !VALID_EMAIL.test(email)),
  };
}
