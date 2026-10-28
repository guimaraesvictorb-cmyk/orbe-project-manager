export const systemNames={none:'Sem CRM',sheets:'Planilha',kommo:'Kommo',bitrix:'Bitrix',vtex:'VTEX',rd_station:'RD Station'}
export type ConnectionMethod='undecided'|'qr'|'kommo'|'official'
export type TrackingSetup={client_id:string;owner_user_id:string;connection_method:ConnectionMethod;system:keyof typeof systemNames;destination:string;account_url:string;notes:string;activation_requested:boolean;traffic_active:boolean}
