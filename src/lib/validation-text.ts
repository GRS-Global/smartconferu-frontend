/* The API's validation messages are written for developers ("maxPages must not be greater than 500"). This turns the common ones into
   a sentence for the person using the form. A message it does not know is returned as it came. */

/** "doubleMaxPages" -> "double max pages". */
const words = (field: string) => field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function friendlyValidation(message: string): string {
  const m = (re: RegExp) => message.match(re);
  let r: RegExpMatchArray | null;
  if ((r = m(/^([A-Za-z][\w]*) must be shorter than or equal to (\d+) characters?$/))) return `${sentence(words(r[1]))} can have at most ${r[2]} characters.`;
  if ((r = m(/^([A-Za-z][\w]*) must be longer than or equal to (\d+) characters?$/))) return `${sentence(words(r[1]))} needs at least ${r[2]} characters.`;
  if ((r = m(/^([A-Za-z][\w]*) must be on or after ([A-Za-z][\w]*)$/))) return `${sentence(words(r[1]))} must be on or after the ${words(r[2])}.`;
  if ((r = m(/^([A-Za-z][\w]*) must be on or before ([A-Za-z][\w]*)$/))) return `${sentence(words(r[1]))} must be on or before the ${words(r[2])}.`;
  if ((r = m(/^([A-Za-z][\w]*) must not be greater than (\d+)$/))) return `${sentence(words(r[1]))} can be at most ${r[2]}.`;
  if ((r = m(/^([A-Za-z][\w]*) must not be less than (\d+)$/))) return `${sentence(words(r[1]))} must be at least ${r[2]}.`;
  if ((r = m(/^([A-Za-z][\w]*) must be an integer number$/))) return `${sentence(words(r[1]))} must be a whole number.`;
  if ((r = m(/^([A-Za-z][\w]*) must be a number conforming to the specified constraints$/))) return `${sentence(words(r[1]))} must be a number.`;
  if ((r = m(/^([A-Za-z][\w]*) should not be empty$/))) return `${sentence(words(r[1]))} is required.`;
  if ((r = m(/^([A-Za-z][\w]*) must be an email$/))) return `${sentence(words(r[1]))} must be a valid email address.`;
  return message;
}
