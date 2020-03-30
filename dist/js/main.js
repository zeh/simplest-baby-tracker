// Constants

const MILISECONDS_IN_HOUR = 24 * 60 * 60 * 1000;
const MILISECONDS_IN_DAY = MILISECONDS_IN_HOUR * 24;

const STORAGE = window.localStorage;
const STORAGE_ID_PAST_LIST = "pastEventList";
const STORAGE_ID_FUTURE_LIST = "futureEventList";
const EVENT_SUFFIX_TOGGLE_START = "_start";
const EVENT_SUFFIX_TOGGLE_STOP = "_stop";
const MAX_EVENT_LIST_ITEMS = 400;
const UI_UPDATE_INTERVAL = 1000;
const MAX_TIME_BEFORE_REFRESH = MILISECONDS_IN_HOUR * 12;

const EventTypes = {
	FEED: "feed",
	PEE: "pee",
	POOP: "poop",
	SLEEP: "sleep",
};

const StatusTypes = {
	EVENT_COUNT: "eventCount",
	NONE: "none",
	TOTAL_TIME: "totalTime",
};


// Other global properties

let pastEventList = JSON.parse(STORAGE.getItem(STORAGE_ID_PAST_LIST) || "[]");
let futureEventList = JSON.parse(STORAGE.getItem(STORAGE_ID_FUTURE_LIST) || "[]");
let updateIntervalId = undefined;
let timeStarted = Date.now();
let dayViewOffset = 0; // -1 = looking at yesterday


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

const getLastEventIndexOfType = (list, type, dayOffset = 0) => {
	const maxTime = getDateWithOffset(dayOffset + 1).getTime();
	for (let i = list.length - 1; i >= 0; i--) {
		const event = pastEventList[i];
		if (event.type === type && event.time <= maxTime) return i;
	}
	return -1;
}

const getTotalEventTime = (type, dayOffset, maxTime = -1) => {
	const now = new Date(Date.now());
	const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
	const endTime = maxTime > 0 ? maxTime : new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset + 1);

	const startType = type + EVENT_SUFFIX_TOGGLE_START;
	const stopType = type + EVENT_SUFFIX_TOGGLE_STOP;

	let totalTimeMS = 0;
	let lastStartTime = -1;

	pastEventList.forEach((e) => {
		if (e.time >= startTime && e.time <= endTime) {
			if (e.type === stopType) {
				// Stopping
				if (lastStartTime < 0) {
					// Never started on this day, so assume started at midnight
					totalTimeMS += e.time - startTime;
				} else {
					totalTimeMS += e.time - lastStartTime;
				}
			} else if (e.type === startType) {
				lastStartTime = e.time;
			}
		} else {
			if (lastStartTime > 0) {
				// Started and never stopped, so assume ended at midnight
				totalTimeMS += endTime - lastStartTime;
				lastStartTime = -1;
			}
		}
	});

	return totalTimeMS;
}

const trackEvent = (type) => {
	const newEvent = {
		type: type,
		time: Date.now(), // To track previous days: getDateWithOffset(dayViewOffset).getTime(),
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

const offsetDay = (num) => {
	dayViewOffset = Math.min(dayViewOffset + num, 0);
	requestUIUpdate();
};

const resetData = () => {
	STORAGE.clear();
	location.reload();
};

const getFormattedDay = (date) => {
	const months = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Set", "Oct", "Nov", "Dec" ];
	return `${months[date.getMonth()]} ${date.getDate()}`;
};

const getAbsoluteTime = (time) => {
	const now = new Date();
	const startDayNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startDayTime = new Date(time.getFullYear(), time.getMonth(), time.getDate());
	const daysAgo = Math.round((startDayNow.getTime() - startDayTime.getTime()) / MILISECONDS_IN_DAY);
	const formattedDay = getFormattedDay(time);
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

const getIntervalDescription = (timeMS) => {
	const timeSeconds = timeMS / 1000;
	const timeMinutes = timeSeconds / 60;
	const timeHours = timeMinutes / 60;

	if (timeMinutes < 60) {
		const mm = Math.floor(timeMinutes);
		return `${mm}m`;
	} else {
		const hh = Math.floor(timeHours);
		const mm = Math.floor(timeMinutes % 60);
		if (mm > 0) {
			return `${hh}h ${mm}m`;
		} else {
			return `${hh}h`;
		}
	}
};

const getRelativeTime = (time) => {
	const diff = Date.now() - time.getTime();
	if (diff < 60 * 1000) {
		return "just now";
	} else {
		return `${getIntervalDescription(diff)} ago`;
	}
};

const getEventCountForDay = (type, dayOffset) => {
	const now = new Date(Date.now());
	const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset).getTime();
	const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset + 1).getTime();
	return pastEventList.filter((e) => e.type === type && e.time >= startTime && e.time <= endTime).length;
};

const getDateWithOffset = (dayOffset) => {
	const now = new Date(Date.now());
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
};


// App functions

const updateElementStatusWithEvent = (elementQuery, type, preStatus, statusType = StatusTypes.EVENT_COUNT) => {
	const statusElement = document.querySelector(`${elementQuery} .status`);
	if (statusElement) {
		const lastEventIndex = getLastEventIndexOfType(pastEventList, type, dayViewOffset);
		let lines = [ "Not tracked yet", "&nbsp;", "&nbsp;" ];
		if (lastEventIndex > -1) {
			const lastEvent = pastEventList[lastEventIndex];
			const time = new Date(lastEvent.time);
			lines[0] = `${preStatus ? preStatus : "Last"} ${getRelativeTime(time)}`;
			lines[1] = `<span class='secondary'>(${getAbsoluteTime(time)})</span>`;

			if (statusType === StatusTypes.EVENT_COUNT) {
				// Show count
				const numTimesToday = getEventCountForDay(type, dayViewOffset);

				if (numTimesToday > 0) {
					lines[2] = `<span class='tertiary'>${numTimesToday} times</span>`;
				}
			} else if (statusType === StatusTypes.TOTAL_TIME) {
				const rootType = type.substr(0, type.length - (type.endsWith(EVENT_SUFFIX_TOGGLE_START) ? EVENT_SUFFIX_TOGGLE_START.length : EVENT_SUFFIX_TOGGLE_STOP.length));
				const time = getTotalEventTime(rootType, dayViewOffset, Date.now());
				const dayLabel = dayViewOffset === 0 ? " today" : "";
				lines[2] = `<span class='tertiary'>Total ${getIntervalDescription(time)}${dayLabel}</span>`;
			}
		}
		statusElement.innerHTML = lines.join("<br>");
	} else {
		console.warn(`Element not found for query "${elementQuery}"`);
	}
};

const updateElementWithDate = (elementQuery) => {
	const labelElement = document.querySelector(`${elementQuery}`);
	if (labelElement) {
		const date = getDateWithOffset(dayViewOffset);
		const formattedDay = getFormattedDay(date);
		if (dayViewOffset === 0) {
			labelElement.innerHTML = `${formattedDay} (TODAY)`;
		} else {
			labelElement.innerHTML = formattedDay;
		}
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
	// Toolbar

	setElementEnabled("#undoButton", canUndoTrack());
	setElementEnabled("#redoButton", canRedoTrack());

	// Baby status

	const isBabySleeping = isToggleableEventStarted(EventTypes.SLEEP);
	const showingToday = dayViewOffset === 0;
	const shouldShowBabySleeping = isBabySleeping || !showingToday;
	setElementVisibility("#babyStatusAwake", !shouldShowBabySleeping);
	setElementVisibility("#babyStatusAsleep", shouldShowBabySleeping);

	if (!showingToday) {
		updateElementStatusWithEvent("#babyStatusAsleep", EventTypes.SLEEP + EVENT_SUFFIX_TOGGLE_START);
	} else if (isBabySleeping) {
		updateElementStatusWithEvent("#babyStatusAsleep", EventTypes.SLEEP + EVENT_SUFFIX_TOGGLE_START, "Fell asleep", StatusTypes.TOTAL_TIME);
	} else {
		updateElementStatusWithEvent("#babyStatusAwake", EventTypes.SLEEP + EVENT_SUFFIX_TOGGLE_STOP, "Woke up", StatusTypes.TOTAL_TIME);
	}

	// Event buttons

	updateElementStatusWithEvent("#poopButton", EventTypes.POOP);
	updateElementStatusWithEvent("#peeButton", EventTypes.PEE);
	updateElementStatusWithEvent("#feedButton", EventTypes.FEED);

	// Footer
	updateElementWithDate("#dateLabel");
	setElementEnabled("#dayPlusButton", dayViewOffset < 0);
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

		// If enough time has passed, we reload the page to force the web app to update
		if (Date.now() - timeStarted > MAX_TIME_BEFORE_REFRESH) {
			location.reload();
		}
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
