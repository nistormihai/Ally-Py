/* A JavaScript implementation of the SHA family of hashes, as defined in FIPS
 * PUB 180-2 as well as the corresponding HMAC implementation as defined in
 * FIPS PUB 198a
 *
 * Version 1.31 Copyright Brian Turek 2008-2012
 * Distributed under the BSD License
 * See http://caligatio.github.com/jsSHA/ for more information
 *
 * Several functions taken from Paul Johnson
 */
define(function ()
{
	var charSize = 8,
	b64pad = "",
	hexCase = 0,

	Int_64 = function (msint_32, lsint_32)
	{
		this.highOrder = msint_32;
		this.lowOrder = lsint_32;
	},

	str2binb = function (str)
	{
		var bin = [], mask = (1 << charSize) - 1,
			length = str.length * charSize, i;

		for (i = 0; i < length; i += charSize)
		{
			bin[i >> 5] |= (str.charCodeAt(i / charSize) & mask) <<
				(32 - charSize - (i % 32));
		}

		return bin;
	},

	hex2binb = function (str)
	{
		var bin = [], length = str.length, i, num;

		for (i = 0; i < length; i += 2)
		{
			num = parseInt(str.substr(i, 2), 16);
			if (!isNaN(num))
			{
				bin[i >> 3] |= num << (24 - (4 * (i % 8)));
			}
			else
			{
				return "INVALID HEX STRING";
			}
		}

		return bin;
	},

	binb2hex = function (binarray)
	{
		var hex_tab = (hexCase) ? "0123456789ABCDEF" : "0123456789abcdef",
			str = "", length = binarray.length * 4, i, srcByte;

		for (i = 0; i < length; i += 1)
		{
			srcByte = binarray[i >> 2] >> ((3 - (i % 4)) * 8);
			str += hex_tab.charAt((srcByte >> 4) & 0xF) +
				hex_tab.charAt(srcByte & 0xF);
		}

		return str;
	},

	binb2b64 = function (binarray)
	{
		var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
			"0123456789+/", str = "", length = binarray.length * 4, i, j,
			triplet;

		for (i = 0; i < length; i += 3)
		{
			triplet = (((binarray[i >> 2] >> 8 * (3 - i % 4)) & 0xFF) << 16) |
				(((binarray[i + 1 >> 2] >> 8 * (3 - (i + 1) % 4)) & 0xFF) << 8) |
				((binarray[i + 2 >> 2] >> 8 * (3 - (i + 2) % 4)) & 0xFF);
			for (j = 0; j < 4; j += 1)
			{
				if (i * 8 + j * 6 <= binarray.length * 32)
				{
					str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
				}
				else
				{
					str += b64pad;
				}
			}
		}
		return str;
	},

	rotr = function (x, n)
	{
		if (n <= 32)
		{
			return new Int_64(
					(x.highOrder >>> n) | (x.lowOrder << (32 - n)),
					(x.lowOrder >>> n) | (x.highOrder << (32 - n))
				);
		}
		else
		{
			return new Int_64(
					(x.lowOrder >>> n) | (x.highOrder << (32 - n)),
					(x.highOrder >>> n) | (x.lowOrder << (32 - n))
				);
		}
	},

	shr = function (x, n)
	{
		if (n <= 32)
		{
			return new Int_64(
					x.highOrder >>> n,
					x.lowOrder >>> n | (x.highOrder << (32 - n))
				);
		}
		else
		{
			return new Int_64(
					0,
					x.highOrder << (32 - n)
				);
		}
	},

	ch = function (x, y, z)
	{
		return new Int_64(
				(x.highOrder & y.highOrder) ^ (~x.highOrder & z.highOrder),
				(x.lowOrder & y.lowOrder) ^ (~x.lowOrder & z.lowOrder)
			);
	},

	maj = function (x, y, z)
	{
		return new Int_64(
				(x.highOrder & y.highOrder) ^
				(x.highOrder & z.highOrder) ^
				(y.highOrder & z.highOrder),
				(x.lowOrder & y.lowOrder) ^
				(x.lowOrder & z.lowOrder) ^
				(y.lowOrder & z.lowOrder)
			);
	},

	sigma0 = function (x)
	{
		var rotr28 = rotr(x, 28), rotr34 = rotr(x, 34), rotr39 = rotr(x, 39);

		return new Int_64(
				rotr28.highOrder ^ rotr34.highOrder ^ rotr39.highOrder,
				rotr28.lowOrder ^ rotr34.lowOrder ^ rotr39.lowOrder);
	},

	sigma1 = function (x)
	{
		var rotr14 = rotr(x, 14), rotr18 = rotr(x, 18), rotr41 = rotr(x, 41);

		return new Int_64(
				rotr14.highOrder ^ rotr18.highOrder ^ rotr41.highOrder,
				rotr14.lowOrder ^ rotr18.lowOrder ^ rotr41.lowOrder);
	},

	gamma0 = function (x)
	{
		var rotr1 = rotr(x, 1), rotr8 = rotr(x, 8), shr7 = shr(x, 7);

		return new Int_64(
				rotr1.highOrder ^ rotr8.highOrder ^ shr7.highOrder,
				rotr1.lowOrder ^ rotr8.lowOrder ^ shr7.lowOrder
			);
	},

	gamma1 = function (x)
	{
		var rotr19 = rotr(x, 19), rotr61 = rotr(x, 61), shr6 = shr(x, 6);

		return new Int_64(
				rotr19.highOrder ^ rotr61.highOrder ^ shr6.highOrder,
				rotr19.lowOrder ^ rotr61.lowOrder ^ shr6.lowOrder
			);
	},

	safeAdd_2 = function (x, y)
	{
		var lsw, msw, lowOrder, highOrder;

		lsw = (x.lowOrder & 0xFFFF) + (y.lowOrder & 0xFFFF);
		msw = (x.lowOrder >>> 16) + (y.lowOrder >>> 16) + (lsw >>> 16);
		lowOrder = ((msw & 0xFFFF) << 16) | (lsw & 0xFFFF);

		lsw = (x.highOrder & 0xFFFF) + (y.highOrder & 0xFFFF) + (msw >>> 16);
		msw = (x.highOrder >>> 16) + (y.highOrder >>> 16) + (lsw >>> 16);
		highOrder = ((msw & 0xFFFF) << 16) | (lsw & 0xFFFF);

		return new Int_64(highOrder, lowOrder);
	},

	safeAdd_4 = function (a, b, c, d)
	{
		var lsw, msw, lowOrder, highOrder;

		lsw = (a.lowOrder & 0xFFFF) + (b.lowOrder & 0xFFFF) +
			(c.lowOrder & 0xFFFF) + (d.lowOrder & 0xFFFF);
		msw = (a.lowOrder >>> 16) + (b.lowOrder >>> 16) +
			(c.lowOrder >>> 16) + (d.lowOrder >>> 16) + (lsw >>> 16);
		lowOrder = ((msw & 0xFFFF) << 16) | (lsw & 0xFFFF);

		lsw = (a.highOrder & 0xFFFF) + (b.highOrder & 0xFFFF) +
			(c.highOrder & 0xFFFF) + (d.highOrder & 0xFFFF) + (msw >>> 16);
		msw = (a.highOrder >>> 16) + (b.highOrder >>> 16) +
			(c.highOrder >>> 16) + (d.highOrder >>> 16) + (lsw >>> 16);
		highOrder = ((msw & 0xFFFF) << 16) | (lsw & 0xFFFF);

		return new Int_64(highOrder, lowOrder);
	},

	safeAdd_5 = function (a, b, c, d, e)
	{
		var lsw, msw, lowOrder, highOrder;

		lsw = (a.lowOrder & 0xFFFF) + (b.lowOrder & 0xFFFF) +
			(c.lowOrder & 0xFFFF) + (d.lowOrder & 0xFFFF) +
			(e.lowOrder & 0xFFFF);
		msw = (a.lowOrder >>> 16) + (b.lowOrder >>> 16) +
			(c.lowOrder >>> 16) + (d.lowOrder >>> 16) + (e.lowOrder >>> 16) +
			(lsw >>> 16);
		lowOrder = ((msw & 0xFFFF) << 16) | (lsw & 0xFFFF);

		lsw = (a.highOrder & 0xFFFF) + (b.highOrder & 0xFFFF) +
			(c.highOrder & 0xFFFF) + (d.highOrder & 0xFFFF) +
			(e.highOrder & 0xFFFF) + (msw >>> 16);
		msw = (a.highOrder >>> 16) + (b.highOrder >>> 16) +
			(c.highOrder >>> 16) + (d.highOrder >>> 16) +
			(e.highOrder >>> 16) + (lsw >>> 16);
		highOrder = ((msw & 0xFFFF) << 16) | (lsw & 0xFFFF);

		return new Int_64(highOrder, lowOrder);
	},

	coreSHA2 = function (message, messageLen, variant)
	{
		var a, b, c, d, e, f, g, h, T1, T2, H, lengthPosition, i, t,
			K, W = [], appendedMessageLength;

		if (variant === "SHA-384" || variant === "SHA-512")
		{
			lengthPosition = (((messageLen + 128) >> 10) << 5) + 31;

			K = [
				new Int_64(0x428a2f98, 0xd728ae22), new Int_64(0x71374491, 0x23ef65cd),
				new Int_64(0xb5c0fbcf, 0xec4d3b2f), new Int_64(0xe9b5dba5, 0x8189dbbc),
				new Int_64(0x3956c25b, 0xf348b538), new Int_64(0x59f111f1, 0xb605d019),
				new Int_64(0x923f82a4, 0xaf194f9b), new Int_64(0xab1c5ed5, 0xda6d8118),
				new Int_64(0xd807aa98, 0xa3030242), new Int_64(0x12835b01, 0x45706fbe),
				new Int_64(0x243185be, 0x4ee4b28c), new Int_64(0x550c7dc3, 0xd5ffb4e2),
				new Int_64(0x72be5d74, 0xf27b896f), new Int_64(0x80deb1fe, 0x3b1696b1),
				new Int_64(0x9bdc06a7, 0x25c71235), new Int_64(0xc19bf174, 0xcf692694),
				new Int_64(0xe49b69c1, 0x9ef14ad2), new Int_64(0xefbe4786, 0x384f25e3),
				new Int_64(0x0fc19dc6, 0x8b8cd5b5), new Int_64(0x240ca1cc, 0x77ac9c65),
				new Int_64(0x2de92c6f, 0x592b0275), new Int_64(0x4a7484aa, 0x6ea6e483),
				new Int_64(0x5cb0a9dc, 0xbd41fbd4), new Int_64(0x76f988da, 0x831153b5),
				new Int_64(0x983e5152, 0xee66dfab), new Int_64(0xa831c66d, 0x2db43210),
				new Int_64(0xb00327c8, 0x98fb213f), new Int_64(0xbf597fc7, 0xbeef0ee4),
				new Int_64(0xc6e00bf3, 0x3da88fc2), new Int_64(0xd5a79147, 0x930aa725),
				new Int_64(0x06ca6351, 0xe003826f), new Int_64(0x14292967, 0x0a0e6e70),
				new Int_64(0x27b70a85, 0x46d22ffc), new Int_64(0x2e1b2138, 0x5c26c926),
				new Int_64(0x4d2c6dfc, 0x5ac42aed), new Int_64(0x53380d13, 0x9d95b3df),
				new Int_64(0x650a7354, 0x8baf63de), new Int_64(0x766a0abb, 0x3c77b2a8),
				new Int_64(0x81c2c92e, 0x47edaee6), new Int_64(0x92722c85, 0x1482353b),
				new Int_64(0xa2bfe8a1, 0x4cf10364), new Int_64(0xa81a664b, 0xbc423001),
				new Int_64(0xc24b8b70, 0xd0f89791), new Int_64(0xc76c51a3, 0x0654be30),
				new Int_64(0xd192e819, 0xd6ef5218), new Int_64(0xd6990624, 0x5565a910),
				new Int_64(0xf40e3585, 0x5771202a), new Int_64(0x106aa070, 0x32bbd1b8),
				new Int_64(0x19a4c116, 0xb8d2d0c8), new Int_64(0x1e376c08, 0x5141ab53),
				new Int_64(0x2748774c, 0xdf8eeb99), new Int_64(0x34b0bcb5, 0xe19b48a8),
				new Int_64(0x391c0cb3, 0xc5c95a63), new Int_64(0x4ed8aa4a, 0xe3418acb),
				new Int_64(0x5b9cca4f, 0x7763e373), new Int_64(0x682e6ff3, 0xd6b2b8a3),
				new Int_64(0x748f82ee, 0x5defb2fc), new Int_64(0x78a5636f, 0x43172f60),
				new Int_64(0x84c87814, 0xa1f0ab72), new Int_64(0x8cc70208, 0x1a6439ec),
				new Int_64(0x90befffa, 0x23631e28), new Int_64(0xa4506ceb, 0xde82bde9),
				new Int_64(0xbef9a3f7, 0xb2c67915), new Int_64(0xc67178f2, 0xe372532b),
				new Int_64(0xca273ece, 0xea26619c), new Int_64(0xd186b8c7, 0x21c0c207),
				new Int_64(0xeada7dd6, 0xcde0eb1e), new Int_64(0xf57d4f7f, 0xee6ed178),
				new Int_64(0x06f067aa, 0x72176fba), new Int_64(0x0a637dc5, 0xa2c898a6),
				new Int_64(0x113f9804, 0xbef90dae), new Int_64(0x1b710b35, 0x131c471b),
				new Int_64(0x28db77f5, 0x23047d84), new Int_64(0x32caab7b, 0x40c72493),
				new Int_64(0x3c9ebe0a, 0x15c9bebc), new Int_64(0x431d67c4, 0x9c100d4c),
				new Int_64(0x4cc5d4be, 0xcb3e42b6), new Int_64(0x597f299c, 0xfc657e2a),
				new Int_64(0x5fcb6fab, 0x3ad6faec), new Int_64(0x6c44198c, 0x4a475817)
			];

			if (variant === "SHA-384")
			{
				H = [
					new Int_64(0xcbbb9d5d, 0xc1059ed8), new Int_64(0x0629a292a, 0x367cd507),
					new Int_64(0x9159015a, 0x3070dd17), new Int_64(0x0152fecd8, 0xf70e5939),
					new Int_64(0x67332667, 0xffc00b31), new Int_64(0x98eb44a87, 0x68581511),
					new Int_64(0xdb0c2e0d, 0x64f98fa7), new Int_64(0x047b5481d, 0xbefa4fa4)
				];
			}
			else
			{
				H = [
					new Int_64(0x6a09e667, 0xf3bcc908), new Int_64(0xbb67ae85, 0x84caa73b),
					new Int_64(0x3c6ef372, 0xfe94f82b), new Int_64(0xa54ff53a, 0x5f1d36f1),
					new Int_64(0x510e527f, 0xade682d1), new Int_64(0x9b05688c, 0x2b3e6c1f),
					new Int_64(0x1f83d9ab, 0xfb41bd6b), new Int_64(0x5be0cd19, 0x137e2179)
				];
			}
		}

		message[messageLen >> 5] |= 0x80 << (24 - messageLen % 32);
		message[lengthPosition] = messageLen;

		appendedMessageLength = message.length;

		for (i = 0; i < appendedMessageLength; i += 32)
		{
			a = H[0];
			b = H[1];
			c = H[2];
			d = H[3];
			e = H[4];
			f = H[5];
			g = H[6];
			h = H[7];

			for (t = 0; t < 80; t += 1)
			{
				if (t < 16)
				{
					W[t] = new Int_64(message[t * 2 + i],
							message[t * 2 + i + 1]);
				}
				else
				{
					W[t] = safeAdd_4(
							gamma1(W[t - 2]), W[t - 7],
							gamma0(W[t - 15]), W[t - 16]
						);
				}

				T1 = safeAdd_5(h, sigma1(e), ch(e, f, g), K[t], W[t]);
				T2 = safeAdd_2(sigma0(a), maj(a, b, c));
				h = g;
				g = f;
				f = e;
				e = safeAdd_2(d, T1);
				d = c;
				c = b;
				b = a;
				a = safeAdd_2(T1, T2);
			}

			H[0] = safeAdd_2(a, H[0]);
			H[1] = safeAdd_2(b, H[1]);
			H[2] = safeAdd_2(c, H[2]);
			H[3] = safeAdd_2(d, H[3]);
			H[4] = safeAdd_2(e, H[4]);
			H[5] = safeAdd_2(f, H[5]);
			H[6] = safeAdd_2(g, H[6]);
			H[7] = safeAdd_2(h, H[7]);
		}

		switch (variant)
		{
		case "SHA-384":
			return [
				H[0].highOrder, H[0].lowOrder,
				H[1].highOrder, H[1].lowOrder,
				H[2].highOrder, H[2].lowOrder,
				H[3].highOrder, H[3].lowOrder,
				H[4].highOrder, H[4].lowOrder,
				H[5].highOrder, H[5].lowOrder
			];
		case "SHA-512":
			return [
				H[0].highOrder, H[0].lowOrder,
				H[1].highOrder, H[1].lowOrder,
				H[2].highOrder, H[2].lowOrder,
				H[3].highOrder, H[3].lowOrder,
				H[4].highOrder, H[4].lowOrder,
				H[5].highOrder, H[5].lowOrder,
				H[6].highOrder, H[6].lowOrder,
				H[7].highOrder, H[7].lowOrder
			];
		default:
			return [];
		}
	},

	jsSHA = function (srcString, inputFormat)
	{

		this.sha384 = null;
		this.sha512 = null;

		this.strBinLen = null;
		this.strToHash = null;

		if ("HEX" === inputFormat)
		{
			if (0 !== (srcString.length % 2))
			{
				return "TEXT MUST BE IN BYTE INCREMENTS";
			}
			this.strBinLen = srcString.length * 4;
			this.strToHash = hex2binb(srcString);
		}
		else if (("ASCII" === inputFormat) ||
			 ('undefined' === typeof(inputFormat)))
		{
			this.strBinLen = srcString.length * charSize;
			this.strToHash = str2binb(srcString);
		}
		else
		{
			return "UNKNOWN TEXT INPUT TYPE";
		}
	};

	jsSHA.prototype = {
		getHash : function (variant, format)
		{
			var formatFunc = null, message = this.strToHash.slice();

			switch (format)
			{
			case "HEX":
				formatFunc = binb2hex;
				break;
			case "B64":
				formatFunc = binb2b64;
				break;
			default:
				return "FORMAT NOT RECOGNIZED";
			}

			switch (variant)
			{
			case "SHA-384":
				if (null === this.sha384)
				{
					this.sha384 = coreSHA2(message, this.strBinLen, variant);
				}
				return formatFunc(this.sha384);
			case "SHA-512":
				if (null === this.sha512)
				{
					this.sha512 = coreSHA2(message, this.strBinLen, variant);
				}
				return formatFunc(this.sha512);
			default:
				return "HASH NOT RECOGNIZED";
			}
		},

		getHMAC : function (key, inputFormat, variant, outputFormat)
		{
			var formatFunc, keyToUse, i, retVal, keyBinLen, hashBitSize,
				keyWithIPad = [], keyWithOPad = [];

			switch (outputFormat)
			{
			case "HEX":
				formatFunc = binb2hex;
				break;
			case "B64":
				formatFunc = binb2b64;
				break;
			default:
				return "FORMAT NOT RECOGNIZED";
			}

			switch (variant)
			{
			case "SHA-384":
				hashBitSize = 384;
				break;
			case "SHA-512":
				hashBitSize = 512;
				break;
			default:
				return "HASH NOT RECOGNIZED";
			}

			if ("HEX" === inputFormat)
			{
				if (0 !== (key.length % 2))
				{
					return "KEY MUST BE IN BYTE INCREMENTS";
				}
				keyToUse = hex2binb(key);
				keyBinLen = key.length * 4;
			}
			else if ("ASCII" === inputFormat)
			{
				keyToUse = str2binb(key);
				keyBinLen = key.length * charSize;
			}
			else
			{
				return "UNKNOWN KEY INPUT TYPE";
			}

			if (128 < (keyBinLen / 8))
			{
				keyToUse = coreSHA2(keyToUse, keyBinLen, variant);
				keyToUse[31] &= 0xFFFFFF00;
			}
			else if (128 > (keyBinLen / 8))
			{
				keyToUse[31] &= 0xFFFFFF00;
			}

			for (i = 0; i <= 31; i += 1)
			{
				keyWithIPad[i] = keyToUse[i] ^ 0x36363636;
				keyWithOPad[i] = keyToUse[i] ^ 0x5C5C5C5C;
			}

			retVal = coreSHA2(
						keyWithIPad.concat(this.strToHash),
						1024 + this.strBinLen, variant);
			retVal = coreSHA2(
						keyWithOPad.concat(retVal),
						1024 + hashBitSize, variant);

			return (formatFunc(retVal));
		}
	};
	return jsSHA;
});
