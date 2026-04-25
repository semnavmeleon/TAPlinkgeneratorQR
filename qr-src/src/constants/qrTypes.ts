import { TypeNumber } from "../types";
interface TypesMap { [key: number]: TypeNumber; }
const qrTypes: TypesMap = {};
for (let type = 0; type <= 40; type++) { qrTypes[type] = type as TypeNumber; }
export default qrTypes;
