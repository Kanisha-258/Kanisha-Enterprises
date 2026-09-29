/**
 * Escapes user input before it's placed inside a MongoDB $regex.
 *
 * Without this, a search for "a(b" throws a SyntaxError, and a search for
 * "(a+)+b" can hang the server while it backtracks. Always escape.
 */
const escapeRegex = (str = "") => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = escapeRegex;
