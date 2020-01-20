// Constants

const STORAGE = window.localStorage;
const STORAGE_ID_PAST_LIST = "pastEventList";
const STORAGE_ID_FUTURE_LIST = "futureEventList";
const MAX_EVENT_LIST_ITEMS = 400;

const EventTypes = {
	FEED: "feed",
	PEE: "pee",
	POOP: "poop",
	SLEEP: "sleep",
};


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
};

const undoTrack = () => {
	const pastEventList = getPastEventList().concat();
	if (pastEventList.length > 0) {
		const undoneEvent = pastEventList.pop();
		setPastEventList(pastEventList);
		setFutureEventList([undoneEvent, ...getFutureEventList()]);
	}
};

const redoTrack = () => {
	const futureEventList = getFutureEventList().concat();
	if (futureEventList.length > 0) {
		const redoneEvent = futureEventList.shift();
		setPastEventList([...getPastEventList(), redoneEvent]);
		setFutureEventList(futureEventList);
	}
};

const resetData = () => {
	STORAGE.clear();
};


// App functions

// Initialize

console.log("Started.");
