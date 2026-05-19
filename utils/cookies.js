const isProduction = process.env.NODE_ENV === 'production';

function getCookieOptions() {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const isCrossOrigin =
    isProduction &&
    clientUrl &&
    !clientUrl.includes('localhost');

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isCrossOrigin ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function setTokenCookie(res, token) {
  res.cookie('token', token, getCookieOptions());
}

function clearTokenCookie(res) {
  res.clearCookie('token', {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

module.exports = { setTokenCookie, clearTokenCookie, getCookieOptions };
