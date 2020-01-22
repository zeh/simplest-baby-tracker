// Constants

const STORAGE = window.localStorage;
const STORAGE_ID_PAST_LIST = "pastEventList";
const STORAGE_ID_FUTURE_LIST = "futureEventList";
const MAX_EVENT_LIST_ITEMS = 400;
const UI_UPDATE_INTERVAL = 1000;

let pastEventList = JSON.parse(STORAGE.getItem(STORAGE_ID_PAST_LIST) || "[]");
let futureEventList = JSON.parse(STORAGE.getItem(STORAGE_ID_FUTURE_LIST) || "[]");

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

const savePastEventList = () => {
	// Trim the list if too big
	if (pastEventList.length > MAX_EVENT_LIST_ITEMS) {
		// TODO: this might remove valid events if a single event was tracked more than MAX_EVENT_LIST_ITEMS times.
		// It would be better to have a per-type or hour-based cap instead of a simple list size cap.
		pastEventList = pastEventList.slice(-MAX_EVENT_LIST_ITEMS);
	}

	STORAGE.setItem(STORAGE_ID_PAST_LIST, JSON.stringify(pastEventList));
};

const saveFutureEventList = () => {
	STORAGE.setItem(STORAGE_ID_FUTURE_LIST, JSON.stringify(futureEventList));
};

const getLastEventIndexOfType = (list, type) => {
	for (let i = list.length - 1; i >= 0; i--) {
		if (pastEventList[i].type === type) return i;
	}
	return -1;
}

const trackEvent = (type) => {
	const newEvent = {
		type: type,
		time: Date.now(),
	};

	pastEventList.push(newEvent);

	// When tracking a new event, undos are cleared
	futureEventList = [];

	savePastEventList();
	saveFutureEventList();

	requestUIUpdate();
};

const isToggleableEventStarted = (type) => {
	let lastStartEventIndex = getLastEventIndexOfType(pastEventList, type + EVENT_SUFFIX_TOGGLE_START);
	let lastStopEventIndex = getLastEventIndexOfType(pastEventList, type + EVENT_SUFFIX_TOGGLE_STOP);

	// Started, never stopped
	if (lastStartEventIndex > -1 && lastStopEventIndex === -1) return true;

	// Never started
	if (lastStartEventIndex === -1) return false;

	// Started and stopped at some point, so decide based on what happened last
	return lastStartEventIndex > lastStopEventIndex;
};

const trackEventToggle = (type) => {
	const eventHasStarted = isToggleableEventStarted(type);
	if (eventHasStarted) {
		trackEvent(type + EVENT_SUFFIX_TOGGLE_STOP);
	} else {
		trackEvent(type + EVENT_SUFFIX_TOGGLE_START);
	}
};

const canUndoTrack = () => {
	return pastEventList.length > 0;
};

const canRedoTrack = () => {
	return futureEventList.length > 0;
};

const undoTrack = () => {
	if (canUndoTrack()) {
		const undoneEvent = pastEventList.pop();
		futureEventList.unshift(undoneEvent);

		savePastEventList();
		saveFutureEventList();

		requestUIUpdate();
	}
};

const redoTrack = () => {
	if (canRedoTrack()) {
		const redoneEvent = futureEventList.shift();
		pastEventList.push(redoneEvent);

		savePastEventList();
		saveFutureEventList();

		requestUIUpdate();
	}
};

const resetData = () => {
	STORAGE.clear();
	location.reload();
};

const getAbsoluteTime = (time) => {
	const MILISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
	const now = new Date();
	const startDayNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startDayTime = new Date(time.getFullYear(), time.getMonth(), time.getDate());
	const daysAgo = Math.round((startDayNow.getTime() - startDayTime.getTime()) / MILISECONDS_IN_DAY);
	const months = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Set", "Oct", "Nov", "Dec" ];
	const formattedDay = `${months[time.getMonth()]} ${time.getDate()}`;
	const formattedTime =
		(((time.getHours() - 1) % 12) + 1) +
		":" +
		("00" + time.getMinutes()).substr(-2, 2) +
		(time.getHours() >= 12 ? "PM" : "AM");
	if (daysAgo === 0) {
		// Today
		return formattedTime;
	} else if (daysAgo === 1) {
		// Yesterday
		return `Yesterday, ${formattedTime}`;
	} else {
		// Days ago
		return `${formattedDay}, ${formattedTime}`;
	}
};

const getRelativeTime = (time) => {
	const now = new Date(Date.now());
	const diff = now.getTime() - time.getTime();

	const diffSeconds = diff / 1000;
	const diffMinutes = diffSeconds / 60;
	const diffHours = diffMinutes / 60;

	if (diffSeconds < 60) {
		return "just now";
	} else if (diffMinutes < 60) {
		const mm = Math.floor(diffMinutes);
		return `${mm}m ago`;
	} else {
		const hh = Math.floor(diffHours);
		const mm = Math.floor(diffMinutes % 60);
		if (mm > 0) {
			return `${hh}h ${mm}m ago`;
		} else {
			return `${hh}h ago`;
		}
	}
};


// App functions

const updateElementWithEventTime = (elementQuery, type, preStatus) => {
	const statusElement = document.querySelector(`${elementQuery} .status`);
	if (statusElement) {
		const lastEventIndex = getLastEventIndexOfType(pastEventList, type);
		if (lastEventIndex > -1) {
			const lastEvent = pastEventList[lastEventIndex];
			const time = new Date(lastEvent.time);
			statusElement.innerHTML = `${preStatus ? preStatus : "Last"} ${getRelativeTime(time)}<br><span class='secondary'>(${getAbsoluteTime(time)})</span>`;
		} else {
			statusElement.innerHTML = "Not tracked yet<br>&nbsp;";
		}
	} else {
		console.warn(`Element not found for query "${elementQuery}"`);
	}
};

const setElementEnabled = (elementQuery, enabled) => {
	const element = document.querySelector(elementQuery);
	if (element) {
		element.style.opacity = enabled ? "inherit" : "0.4";
	}
};

const setElementVisibility = (elementQuery, visible) => {
	const element = document.querySelector(elementQuery);
	if (element) {
		element.style.display = visible ? "inherit" : "none";
	}
};

const updateUI = () => {
	setElementEnabled("#undoButton", canUndoTrack());
	setElementEnabled("#redoButton", canRedoTrack());

	updateElementWithEventTime("#poopButton", EventTypes.POOP);
	updateElementWithEventTime("#peeButton", EventTypes.PEE);
	updateElementWithEventTime("#feedButton", EventTypes.FEED);

	const sleepEventHasStarted = isToggleableEventStarted(EventTypes.SLEEP);

	setElementVisibility("#sleepStartButton", !sleepEventHasStarted);
	setElementVisibility("#sleepStopButton", sleepEventHasStarted);

	if (sleepEventHasStarted) {
		updateElementWithEventTime("#sleepStopButton", EventTypes.SLEEP + EVENT_SUFFIX_TOGGLE_START, "Fell asleep");
	} else {
		updateElementWithEventTime("#sleepStartButton", EventTypes.SLEEP + EVENT_SUFFIX_TOGGLE_STOP, "Woke up");
	}
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
