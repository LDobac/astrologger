import "dayjs/locale/ko";
import dayjs from "dayjs";
dayjs.locale("ko");

const FormattedDate = (date: Date) => {
    return dayjs(date).format("YYYY년 MM월 DD일");
}

export {
    FormattedDate
}
