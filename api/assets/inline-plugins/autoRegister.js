// Auto register guest account:
(function() {
const prefix = [
	"mysterious",
	"adventurous",
	"courageous",
	"precious",
	"cynical",
	"flamer ",
	"despicable",
	"suspicious",
	"gorgeous",
	"impeccable",
	"lovely",
	"stunning",
	"keyed",
	"phoned",
	"glorious",
	"amazing",
	"strange",
	"arcane"
];
const suffix = [
	"Anonymous",
	"Boy",
	"Lurker",
	"Keyhitter",
	"User",
	"Enjoyer",
	"Hunk",
	"Coolstar",
	"Wrestling",
	"TylerTheCreator",
	"Ad",
	"Gamer",
	"Games",
	"Programmer"
];

Array.prototype.random = function () {
	return this[Math.floor(Math.random() * this.length)];
};

function _generateName() {
	return `${prefix.random()}${suffix.random()}`;
}

var token = JSON.parse(localStorage.getItem("token"));
if (!token && location.pathname !== "/login" && location.pathname !== "/register") {
	const apiEndpoint = window.GLOBAL_ENV?.API_ENDPOINT || "/api";
	fetch(`${apiEndpoint}/auth/register`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			username: `${_generateName()}`,
			consent: true,
			date_of_birth: "2000-01-01"
		}) //${Date.now().toString().slice(-4)}
	})
		.then((x) => x.json())
		.then((x) => {
			localStorage.setItem("token", `"${x.token}"`);
			// Client boot may already be in progress; reload so the new token is picked up consistently.
			location.reload();
		});
}
})();
