module.exports = function health(req, res) {
  res.status(200).json({
    ok: true,
    platform: "vercel",
    route: "/api/health"
  });
};
