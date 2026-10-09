// Deliberately disabled boundaries, not pretend connections or working send adapters.
export interface FutureMessagingAdapter {
 readonly channel:'linkedin'|'whatsapp';
 status():{connected:false;implemented:false;reason:string};
}
export const futureMessaging:FutureMessagingAdapter[]=[
 {channel:'linkedin',status:()=>({connected:false,implemented:false,reason:'No approved LinkedIn API product/account access is verified. Personal unattended DMs are not implemented.'})},
 {channel:'whatsapp',status:()=>({connected:false,implemented:false,reason:'No Meta business account, permitted number, opt-in/template eligibility or zero-paid-cost sending path is verified.'})},
];
export const gmailFiling={implemented:false,reason:'gmail.send cannot read, label or file mail. A justified filing feature would need new permissions and fresh consent.'};
