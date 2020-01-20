// Constants

const STORAGE = window.localStorage;
const STORAGE_ID_PAST_LIST = "pastEventList";
const STORAGE_ID_FUTURE_LIST = "futureEventList";
const MAX_EVENT_LIST_ITEMS = 400;
const UI_UPDATE_INTERVAL = 1000;

const EventTypes = {
	FEED: "feed",
	PEE: "pee",
	POOP: "poop",
	SLEEP: "sleep",
};

const EVENT_SUFFIX_TOGGLE_START = "_start";
const EVENT_SUFFIX_TOGGLE_STOP = "_stop";


// Other global properties

let updateIntervalId = undefined;


// Common functions

const getPastEventList = () => {
	return JSON.parse(STORAGE.getItem(STORAGE_ID_PAST_LIST) || "[]");
};

const setPastEventList = (list) => {
	// TODO: this might remove valid events if a single event was tracked more than MAX_EVENT_LIST_ITEMS times.
	// It would be better to have a per-type or hour-based cap instead of a simple list size cap.
	STORAGE.setItem(STORAGE_ID_PAST_LIST, JSON.stringify(list.slice(-MAX_EVENT_LIST_ITEMS)));
};

const getFutureEventList = () => {
	return JSON.parse(STORAGE.getItem(STORAGE_ID_FUTURE_LIST) || "[]");
};

const setFutureEventList = (list) => {
	STORAGE.setItem(STORAGE_ID_FUTURE_LIST, JSON.stringify(list));
};

const trackEvent = (type) => {
	const newList = [
		...getPastEventList(),
		{
			type: type,
			time: Date.now(),
		},
	];

	setPastEventList(newList);

	// When tracking a new event, undos are cleared
	setFutureEventList([]);

	requestUIUpdate();
};

const isToggleableEventStarted = (type) => {
	const eventTypeStart = type + EVENT_SUFFIX_TOGGLE_START;
	const eventTypeStop = type + EVENT_SUFFIX_TOGGLE_STOP;
	const pastEventListReverse = getPastEventList().concat().reverse();
	const lastStartEventDistance = pastEventListReverse.findIndex((e) => e.type === eventTypeStart);
	const lastStopEventDistance = pastEventListReverse.findIndex((e) => e.type === eventTypeStop);
	return lastStartEventDistance > -1 && (lastStopEventDistance === -1 || lastStartEventDistance < lastStopEventDistance);
};

const trackEventToggle = (type) => {
	const eventHasStarted = isToggleableEventStarted(type);
	if (eventHasStarted) {
		trackEvent(type + EVENT_SUFFIX_TOGGLE_STOP);
	} else {
		trackEvent(type + EVENT_SUFFIX_TOGGLE_START);
	}
};

const undoTrack = () => {
	const pastEventList = getPastEventList().concat();
	if (pastEventList.length > 0) {
		const undoneEvent = pastEventList.pop();
		setPastEventList(pastEventList);
		setFutureEventList([undoneEvent, ...getFutureEventList()]);

		requestUIUpdate();
	}
};

const redoTrack = () => {
	const futureEventList = getFutureEventList().concat();
	if (futureEventList.length > 0) {
		const redoneEvent = futureEventList.shift();
		setPastEventList([...getPastEventList(), redoneEvent]);
		setFutureEventList(futureEventList);

		requestUIUpdate();
	}
};

const resetData = () => {
	STORAGE.clear();
	requestUIUpdate();
};


// App functions

const updateUI = () => {
	// TODO
};

const requestUIUpdate = () => {
	updateUI();
	startUIUpdateIntervals();
};

const stopUIUpdateIntervals = () => {
	if (updateIntervalId) {
		clearInterval(updateIntervalId);
		updateIntervalId = undefined;
	}
};

const startUIUpdateIntervals = () => {
	stopUIUpdateIntervals();
	updateIntervalId = setInterval(() => {
		updateUI();
	}, UI_UPDATE_INTERVAL);
};

const start = () => {
	requestUIUpdate();
};


// Finally, initialize

setTimeout(() => {
	start();
}, 0);

console.log("Started.");
