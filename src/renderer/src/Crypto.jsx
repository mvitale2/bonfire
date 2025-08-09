import * as libsignal from '@signalapp/libsignal-protocol'

const keyHelper = libsignal.KeyHelper

async function generateKeys() {
    const identityKeyPair = await keyHelper.generateIdentityKeyPair()
    const registrationId = await keyHelper.generateRegistrationId();
}

export default generateKeys;