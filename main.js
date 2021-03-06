const router = new VueRouter();

let app = new Vue({
    router,
    el: '#app',
    data: {
        MAX_ROLL: 999999,
        SATOSHIS: 100000000,
        serverSeed: '',
        serverSeedHash: '',
        clientSeed: '',
        nonce: 1,
        verifiedRolls: []
    },
    created: function() {
        if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
            alert('The File APIs are not fully supported in this browser.');
        }
        this.serverSeed = this.$route.query.server_seed || '';
        this.serverSeedHash = this.$route.query.server_seed_hash || '';
        this.clientSeed = this.$route.query.client_seed || '';
        this.nonce = this.$route.query.nonce || 1;
    },
    methods: {
        hmacsha512: function(K, K2, n) {
            let hash = forge.hmac.create();
            hash.start('sha512', forge.util.hexToBytes(K));
            hash.update(`${K2}.${n}`);
            return hash.digest().toHex();
        },
        sha256: function(K) {
            let md = forge.md.sha256.create();
            md.update(K);
            return md.digest().toHex();
        },
        hashToRoll: function(hash) {
            for(let i = 0; i < 25; i++) {
                let chunk = hash.substr(i * 5, 5);
                let roll = parseInt(chunk, 16);
                if(roll <= this.MAX_ROLL) {
                    return {
                        roll: roll,
                        index: i * 5,
                        chunk: chunk
                    };
                }
            }
            return {
                roll: parseInt(hash.substr(125, 3), 16),
                index: 125,
                chunk: hash.substr(125, 3)
            };
        },
        htmlTemplateHash: function() {
            let hash = this.hmacsha512(this.serverSeed, this.clientSeed, this.nonce);
            let index = this.hashToRoll(hash).index;
            let length = index < 125 ? 5 : 3;
            // Please take note of the use of both substring and substr below
            return `${hash.substring(0, index)}<strong>${hash.substr(index, length)}</strong>${hash.substring(index+length, 128)}`;
        },
        handleFileInput: function(files) {
            let file = files[0];
            let reader = new FileReader();
            reader.onload = function() {
                app.parseCsv(reader.result);
            };
            reader.readAsText(file);
        },
        parseCsv: function(data) {
            this.verifiedRolls = [];
            data = data.split('\n');
            let header = data.shift().split(',');
            this.serverSeedHash = header[1];
            this.serverSeed = header[2];
            this.clientSeed = header[3];
            let noErrors = true;
            for(let line of data) {
                if(line.length !== 0 && line.split(',').length === 7) {
                    line = line.split(',');
                    let roll = {
                        bet_id: line[0],
                        nonce: parseInt(line[1]),
                        roll: parseInt(line[2]),
                        target: line[3],
                        range: line[4],
                        amount: parseFloat(line[5])/this.SATOSHIS,
                        profit: parseFloat(line[6])/this.SATOSHIS,
                        jackpot_profit: parseFloat(line[7])/this.SATOSHIS || 0
                    };
                    roll.verified = this.hashToRoll(this.hmacsha512(this.serverSeed, this.clientSeed, roll.nonce)).roll === roll.roll;
                    this.verifiedRolls.push(roll);
                }
            }
        },
        allBetsVerify: function() {
            for(let i = 0; i < this.verifiedRolls.length; i++) {
                if(!this.verifiedRolls[i].verified) {
                    return false;
                }
            }
            return true;
        }
    }
});
