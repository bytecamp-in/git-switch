/**
 * Normalizes CLI arguments to support single-dash long options.
 * For example:
 *   -uname  -> --uname
 *   -uemail -> --uemail
 *   -name   -> --name
 *   -email  -> --email
 * Single-letter flags (-u, -e, -v, -h) remain untouched.
 *
 * @param {string[]} argv
 * @returns {string[]}
 */
export function normalizeArgv(argv) {
  return argv.map((arg) => {
    // Matches flags starting with a single '-' followed by 2 or more alphabetic characters
    // e.g. -uname, -uemail, -global, -local
    // but not --uname, -u, -e, or negative numbers like -1
    if (/^-[a-zA-Z]{2,}(=.*)?$/.test(arg)) {
      return '-' + arg;
    }
    return arg;
  });
}

