const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const FormattedDate = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? "";

    return `${get("year")}년 ${get("month")}월 ${get("day")}일`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

const FormattedDateTime = (date: Date) => {
    const parts = dateTimeFormatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? "";

    return `${get("year")}. ${get("month")}. ${get("day")}. ${get("hour")}:${get("minute")}`;
}

export {
    FormattedDate,
    FormattedDateTime
}
