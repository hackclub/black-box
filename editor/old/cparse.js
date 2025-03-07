/*
	cparse.js
	original code by Jakob Löw (@M4GNV5)
	https://github.com/M4GNV5/cparse
	edited by sporeball
*/

const ops = {
	"=": 1,
	"+=": 1,
	"-=": 1,
	"*=": 1,
	"/=": 1,
	"%=": 1,
	">>=": 1,
	"<<=": 1,
	"&=": 1,
	"^=": 1,
	"|=": 1,

	"?": 2, //ternary
	":": 2, //ternary

	"||": 3,
	"&&": 4,

	"|": 5,
	"^": 6,
	"&": 7,

	"<": 8,
	">": 8,
	"<=": 8,
	">=": 8,
	"==": 8,
	"!=": 8,

	">>": 9, //shift right
	"<<": 9, //shift left

	"+": 10,
	"-": 10,

	"*": 11,
	"/": 11,
	"%": 11,

	".": 13, //structure member access
	"->": 13 //structure pointer member access
};

let sortedOps = Object.keys(ops);
sortedOps.sort(function(a, b)
{
	return b.length - a.length;
});

const prefixedOps = {
	"++": 12, //prefixed ++
	"--": 12, //prefixed --
	"!": 12, //logical NOT
	"~": 12, //bitwise NOT
	"&": 12, //adress of
	"*": 12, //dereference
	"+": 12, //unary +
	"-": 12, //unary -
	"sizeof": 12
};

const suffixedOps = {
	"++": 13, //suffixed ++
	"--": 13 //suffixed --
};

const rightToLeftAssociativity = {
	"1": true,
	"2": true,
	"12": true
};

const stringEscapes = {
	"a": "\a",
	"b": "\b",
	"f": "\f",
	"n": "\n",
	"r": "\r",
	"t": "\t",
	"v": "\v",
	"\\": "\\",
	"'": "'",
	"\"": "\"",
	"?": "\?"
};

const defaultTypeNames = ["void", "char", "short", "int", "long", "float", "double"];
const defaultTypeModifier = ["signed", "unsigned", "short", "long", "const", "struct", "enum"];

let index;
let position;
let curr;
let typeNames;
let typeModifier;

function sortTypeStrings(typeNames, typeModifier)
{
	typeNames.sort(function(a, b)
	{
		return b.length - a.length;
	});
	typeModifier.sort(function(a, b)
	{
		return b.length - a.length;
	});
}

function parseRoot(src)
{
	let stmts = [];

	while(curr)
	{
		let pos = getPos();

		skipBlanks(src);
		if(lookahead(src, "struct"))
		{
			let stmt = {type: "StructDefinition", member: [], pos: pos};
			stmt.name = readIdentifier(src);

			consume(src, "{");

			while(definitionIncoming(src))
			{
				let def = readDefinition(src);
				stmt.member.push(def);
				consume(src, ";");
			}

			consume(src, "}");

			typeNames.push(stmt.name);
			sortTypeStrings(typeNames, typeModifier);
			stmts.push(stmt);
		}
		else if(lookahead(src, "enum"))
		{
			let stmt = {type: "EnumDefinition", member: [], pos: pos};
			stmt.name = readIdentifier(src);

			consume(src, "{");

			while(identifierIncoming())
			{
				stmt.member.push(readIdentifier(src));

				if(!lookahead(src, ","))
					break;
			}

			consume(src, "}");

			typeNames.push(stmt.name);
			sortTypeStrings(typeNames, typeModifier);
			stmts.push(stmt);
		}
		else if(lookahead(src, "typedef"))
		{
			let def = readDefinition(src);
			def.type = "TypeDefStatement";
			def.pos = pos;

			typeNames.push(def.name);
			sortTypeStrings(typeNames, typeModifier);
			consume(src, ";");

			stmts.push(def);
		}
		else if(definitionIncoming(src))
		{
			let def = readDefinition(src);
			def.pos = pos;

			if(lookahead(src, "(")) //function definition
			{
				def.arguments = parseArgumentDefinition(src);

				if(lookahead(src, ";"))
				{
					def.type = "FunctionDefinition";
				}
				else
				{
					def.type = "FunctionDeclaration";
					def.body = parseBody(src);
				}
				stmts.push(def);
			}
			else // global letiable definition
			{
				if(lookahead(src, "="))
					def.value = parseExpression(src, ";");
				else
					consume(src, ";");

				def.type = "GloballetiableDeclaration";
				stmts.push(def);
			}
		}
		else if(directiveIncoming(src))
		{
			console.log(stmts);
			let def = {};
			console.log(src);
			if(lookahead(src, "#include")) {
				console.log('looked ahead, found #include');
				def.type = "IncludeStatement";
				def.pos = pos;
				def.value = parseInclude(src);
				stmts.push(def);
			}
			else
			{
				def.type = "DefineStatement";
				def.pos = pos;
				let { identifier, value } = parseDefine(src);
				def.identifier = identifier;
				def.value = value;
				stmts.push(def);
			}
		}
		else
		{
			// unexpected("struct, enum, typedef, extern, FunctionDeclaration or letiableDeclaration");
			unexpected('declaration');
		}
	}

	return stmts;
}

function parseArgumentDefinition(src)
{
	let args = [];
	while(definitionIncoming(src))
	{
		args.push(readDefinition(src));

		if(lookahead(src, ")"))
			return args;
		consume(src, ",");
	}
	consume(src, ")");
	return args;
}

function parseBody(src)
{
	let stmts = [];
	consume(src, "{");

	while(!(curr == "}" || !curr))
	{
		let pos = getPos();
		let stmt = parseStatement(src);
		stmts.push(stmt);
	}

	consume(src, "}");
	return stmts;
}

function parseStatement(src)
{
	let pos = getPos();
	if(lookahead(src, "return"))
	{
		return {
			type: "ReturnStatement",
			value: parseExpression(src, ";"),
			pos: pos
		};
	}
	else if(lookahead(src, "if"))
	{
		consume(src, "(");
		let stmt = {type: "IfStatement", pos: pos};
		stmt.condition = parseExpression(src, ")");
		stmt.body = parseBody(src);

		if(lookahead(src, "else"))
			stmt.else = parseBody(src);

		return stmt;
	}
	else if(lookahead(src, "while"))
	{
		consume(src, "(");
		return {
			type: "WhileStatement",
			condition: parseExpression(src, ")"),
			body: parseBody(src),
			pos: pos
		};
	}
	else if(lookahead(src, "do"))
	{
		let stmt = {type: "DoWhileStatement", pos: pos};
		stmt.body = parseBody(src);
		consume(src, "while");
		consume(src, "(");
		stmt.condition = parseExpression(src, ")");
		consume(src, ";");

		return stmt;
	}
	else if(lookahead(src, "for"))
	{
		let stmt = {type: "ForStatement", pos: pos};

		consume(src, "(");
		stmt.init = parseStatement(src);
		stmt.condition = parseExpression(src, ";");
		stmt.step = parseExpression(src, ")");
		stmt.body = parseBody(src);

		return stmt;
	}
	else if(definitionIncoming(src))
	{
		let def = readDefinition(src);
		if(lookahead(src, "="))
			def.value = parseExpression(src, ";");
		else
			consume(src, ";");

		def.type = "letiableDeclaration";
		def.pos = pos;
		return def;
	}
	else
	{
		return {
			type: "ExpressionStatement",
			expression: parseExpression(src, ";"),
			pos: pos
		};
	}
}

function parseExpression(src, end)
{
	let expr = parseBinary(src, parseUnary(src), 0);
	if(end)
		consume(src, end);
	return expr;
}

function peekBinaryOp(src)
{
	let _index = index;
	for(let i = 0; i < sortedOps.length; i++)
	{
		if(lookahead(src, sortedOps[i]))
		{
			index = _index;
			curr = src[index];
			return sortedOps[i];
		}
	}
}

function parseBinary(src, left, minPrec)
{
	let ahead = peekBinaryOp(src);
	while(ahead && ops[ahead] >= minPrec)
	{
		let op = ahead;
		let pos = getPos();
		consume(src, op);
		let right = parseUnary(src);
		ahead = peekBinaryOp(src);

		while(ahead && ops[ahead] > ops[op])
		{
			right = parseBinary(src, right, ops[ahead]);
			ahead = peekBinaryOp(src);
		}

		left = {
			type: "BinaryExpression",
			operator: op,
			left: left,
			right: right,
			pos: pos
		};
	}
	return left;
}

function parseInclude(src)
{
	let end;
	if (lookahead(src, "<"))
	{
		end = ">";
	}
	else if (lookahead(src, "\""))
	{
		end = "\"";
	}
	else
	{
		unexpected("`<` or `\"`");
	}

	let path = readIdentifier(src);
	consume(src, ".h");
	consume(src, end);

	return path;
}

function parseDefine(src)
{
	consume(src, "#define");
	console.log('ok!');

	let identifier = readIdentifier(src);
	let value = readNumber(src);

	let data = { identifier, value };

	return data;
}

function parseUnary(src)
{
	let expr;
	let pos = getPos();

	for(let op in prefixedOps)
	{
		if(lookahead(src, op))
		{
			return {
				type: "PrefixExpression",
				operator: op,
				value: parseUnary(src),
				pos: pos
			};
		}
	}

	if(lookahead(src, "("))
	{
		if(definitionIncoming(src))
		{
			expr = {
				type: "CastExpression",
				targetType: readDefinition(src, true),
			};
			consume(src, ")");
			expr.value = parseUnary(src)
		}
		else
		{
			expr = parseExpression(src, ")");
		}
	}
	else if(lookahead(src, "{"))
	{
		let entries = [];

		while(curr)
		{
			entries.push(parseExpression(src));

			if(!lookahead(src, ","))
				break;
		}
		consume(src, "}");

		expr = {
			type: "Literal",
			value: entries
		};
	}
	else if(lookahead(src, "'"))
	{
		let val = curr.charCodeAt(0);
		if(curr == "\\")
			val = readEscapeSequence().charCodeAt(0);
		else
			next(src, true, true);
		consume(src, "'");

		expr = {
			type: "Literal",
			source: "CharCode",
			value: val
		};
	}
	else if(stringIncoming())
	{
		expr = {
			type: "Literal",
			value: readString(src)
		};
	}
	else if(numberIncoming())
	{
		expr = {
			type: "Literal",
			value: readNumber(src)
		};
	}
	else if(identifierIncoming())
	{
		let val = readIdentifier(src);
		expr = {
			type: "Identifier",
			value: val
		};
	}
	else
	{
		return;
	}

	if(lookahead(src, "["))
	{
		let index = parseExpression(src);
		consume(src, "]");

		expr = {
			type: "IndexExpression",
			value: expr,
			index: index
		};
	}
	else if(lookahead(src, "("))
	{
		let args = [];

		while(curr)
		{
			args.push(parseExpression(src));

			if(!lookahead(src, ","))
				break;
		}
		consume(src, ")");

		expr = {
			type: "CallExpression",
			base: expr,
			arguments: args
		};
	}
	expr.pos = pos;

	let suffixPos = getPos();
	for(let op in suffixedOps)
	{
		if(lookahead(src, op))
		{
			return {
				type: "SuffixExpression",
				operator: op,
				value: expr,
				pos: suffixPos
			};
		}
	}

	return expr;
}

function definitionIncoming(src)
{
	let _index = index;
	for(let i = 0; i < typeModifier.length; i++)
	{
		if(lookahead(src, typeModifier[i]))
		{
			index = _index;
			curr = src[index];
			return true;
		}
	}
	for(let i = 0; i < typeNames.length; i++)
	{
		if(lookahead(src, typeNames[i]))
		{
			index = _index;
			curr = src[index];
			return true;
		}
	}
}

function readDefinition(src, nameless)
{
	let name;
	let pos = getPos();
	let def = {
		type: "Type",
		modifier: [],
		pos: getPos()
	};

	let read;

	do
	{
		read = false;
		for(let i = 0; i < typeModifier.length; i++)
		{
			if(lookahead(src, typeModifier[i]))
			{
				def.modifier.push(typeModifier[i]);
				read = true;
			}
		}
	} while(read);

	for(let i = 0; i < typeNames.length; i++)
	{
		if(lookahead(src, typeNames[i]))
		{
			def.name = typeNames[i];

			while(lookahead(src, "*"))
			{
				//TODO allow 'const' in between
				def = {
					type: "PointerType",
					target: def,
					pos: getPos()
				};
			}

			if(!nameless)
				name = readIdentifier(src);

			while(lookahead(src, "["))
			{
				def = {
					type: "PointerType",
					target: def,
					pos: getPos()
				};

				if(!lookahead(src, "]"))
				{
					def.length = parseExpression(src);
					consume(src, "]");
				}
			}

			if(name)
			{
				def = {
					type: "Definition",
					defType: def,
					name: name,
					pos: pos
				};
			}
			return def;
		}
	}
	// TODO: how do we get this one to trigger?
	unexpected(typeNames.join(", "));
}

function stringIncoming()
{
	return curr && curr == "\"";
}

function readString(src, keepBlanks)
{
	let val = [];
	next(src, true, true);
	while(curr && curr != "\"")
	{
		if(curr == "\\")
		{
			next(src, true, true);
			val.push(readEscapeSequence());
		}
		else
		{
			val.push(curr);
			next(src, true, true);
		}
	}

	if(!lookahead(src, "\"", keepBlanks))
		unexpected("`\"`");

	return val.join("");
}

function readEscapeSequence()
{
	if(curr == "x")
	{
		next(src, true, true);
		let val = 0;
		while(/[0-9A-Fa-f]/.test(curr))
		{
			val = (val << 4) + parseInt(curr, 16);
			next(src, true, true);
		}

		return String.fromCharCode(val);
	}
	else if(/[0-7]/.test(curr))
	{
		let val = 0;
		while(/[0-7]/.test(curr))
		{
			val = (val << 3) + parseInt(curr, 16);
			next(src, true, true);
		}

		return String.fromCharCode(val);
	}
	else if(stringEscapes[curr])
	{
		let escape = stringEscapes[curr];
		next(src, true, true);
		return escape;
	}

	unexpected("escape sequence");
}

function numberIncoming()
{
	return curr && /[0-9]/.test(curr);
}

function readNumber(src, keepBlanks)
{
	let val = read(src, /[0-9\.]/, "Number", /[0-9]/, keepBlanks);
	return parseFloat(val);
}

function identifierIncoming()
{
	return curr && /[A-Za-z_]/.test(curr);
}

function readIdentifier(src, keepBlanks)
{
	return read(src, /[A-Za-z0-9_]/, "Identifier", /[A-Za-z_]/, keepBlanks);
}

function directiveIncoming()
{
	return curr && /#/.test(curr);
}

function read(src, reg, expected, startreg, keepBlanks)
{
	startreg = startreg || reg;

	if(!startreg.test(curr))
		unexpected(expected);

	let val = [curr];
	next(src, true);

	while(curr && reg.test(curr))
	{
		val.push(curr);
		next(src, true);
	}

	if(!keepBlanks)
		skipBlanks(src);

	return val.join("");
}

function getPos()
{
	return {
		line: position.line
	};
}

function unexpected(expected)
{
	let pos = getPos();
	let _curr = JSON.stringify(curr || "EOF");

	let msg = [
		pos.file,
		":",
		pos.line,
		": Expected ",
		expected,
		// ", got ",
		// _curr,
	].join("");
	throw new Error(msg);
}

function lookahead(src, str, keepBlanks)
{
	let _index = index;
	for(let i = 0; i < str.length; i++)
	{
		if(curr != str[i])
		{
			index = _index;
			curr = src[index];
			return false;
		}
		next(src, true);
	}

	if(/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(str) && /[_a-zA-Z]/.test(curr))
	{
		index = _index;
		curr = src[index];
		return false;
	}

	if(!keepBlanks)
		skipBlanks(src);
	return true;
}

function consume(src, str)
{
	for(let i = 0; i < str.length; i++)
	{
		if(curr != str[i])
		{
			unexpected('`' + str + '`');
		}
		next(src);
	}
}

function skipBlanks(src)
{
	if(/[\s\n]/.test(curr))
		next(src);
}

function next(src, includeSpaces, includeComments)
{
	includeSpaces = includeSpaces || false;

	if(curr == "\n")
		position.line++;
	index++;
	curr = src[index];

	let skipped;

	do
	{
		skipped = skipComments(src, includeComments) || skipSpaces(src, includeSpaces);
	} while(skipped);
}

function skipSpaces(src, includeSpaces)
{
	if(includeSpaces)
		return;

	if(/[\s\n]/.test(curr))
	{
		while(curr && /[\s\n]/.test(curr))
		{
			if(curr == "\n")
				position.line++;
			index++;
			curr = src[index];
		}
		return true;
	}
}

function skipComments(src, includeComments)
{
	if(includeComments)
		return;
	if(curr && curr == "/" && src[index + 1] == "/")
	{
		while(curr != "\n")
		{
			index++;
			curr = src[index];
		}
		return true;
	}
	if(curr && curr == "/" && src[index + 1] == "*")
	{
		while(curr != "*" || src[index + 1] != "/")
		{
			if(curr == "\n")
				position.line++;
			index++;
			curr = src[index];
		}
		index += 2;
		curr = src[index];
		return true;
	}
}

export default function cparse (src, options) {
	options = options || {};
	typeNames = options.types || defaultTypeNames.slice(0);
	typeModifier = options.modifier || defaultTypeModifier.slice(0);

	index = -1;
	position = {line: 1};

	sortTypeStrings(typeNames, typeModifier);

	next(src);
	return parseRoot(src);
}
