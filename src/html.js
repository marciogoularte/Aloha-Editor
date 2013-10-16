/* html.js is part of Aloha Editor project http://aloha-editor.org
 *
 * Aloha Editor is a WYSIWYG HTML5 inline editing library and editor.
 * Copyright (c) 2010-2013 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://aloha-editor.org/contribution.php
 */
define([
	'dom',
	'cursors',
	'content',
	'traversing',
	'functions'
], function Html(
	dom,
	cursors,
	content,
	traversing,
	fn
) {
	'use strict';

	if ('undefined' !== typeof mandox) {
		eval(uate)('html');
	}

	/**
	 * White space characters as defined by HTML 4
	 * (http://www.w3.org/TR/html401/struct/text.html)
	 *
	 * @type {RegExp}
	 */
	var nonWhitespaceRx = /[^\r\n\t\f \u200B]/;

	var nonBlockDisplayValuesMap = {
		'inline'       : true,
		'inline-block' : true,
		'inline-table' : true,
		'none'         : true
	};

	/**
	 * A map of node tag names which are classified as block-level element.
	 *
	 * NB: "block-level" is not technically defined for elements that are new in
	 * HTML5.
	 *
	 * @type {Object}
	 */
	var BLOCK_LEVEL_ELEMENTS = {
		'ADDRESS'    : true,
		'ARTICLE'    : true, // HTML5
		'ASIDE'      : true, // HTML5
		'AUDIO'      : true, // HTML5
		'BLOCKQUOTE' : true,
		'CANVAS'     : true, // HTML5
		'DD'         : true,
		'DIV'        : true,
		'DL'         : true,
		'FIELDSET'   : true,
		'FIGCAPTION' : true,
		'FIGURE'     : true,
		'FOOTER'     : true,
		'FORM'       : true,
		'H1'         : true,
		'H2'         : true,
		'H3'         : true,
		'H4'         : true,
		'H5'         : true,
		'H6'         : true,
		'HEADER'     : true,
		'HGROUP'     : true,
		'HR'         : true,
		'NOSCRIPT'   : true,
		'OL'         : true,
		'OUTPUT'     : true,
		'P'          : true,
		'PRE'        : true,
		'SECTION'    : true, // HTML5
		'TABLE'      : true,
		'TFOOT'      : true,
		'UL'         : true,
		'VIDEO'      : true  // HTML5
	};

	/**
	 * Void elements are elements which are not permitted to contain content.
	 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element
	 *
	 * @type {Object}
	 */
	var VOID_ELEMENTS = {
		'AREA'    : true,
		'BASE'    : true,
		'BR'      : true,
		'COL'     : true,
		'COMMAND' : true,
		'EMBED'   : true,
		'HR'      : true,
		'IMG'     : true,
		'INPUT'   : true,
		'KEYGEN'  : true, // HTML5
		'LINK'    : true,
		'META'    : true,
		'PARAM'   : true,
		'SOURCE'  : true,
		'TRACK'   : true,
		'WBR'     : true
	};

	var TEXT_LEVEL_SEMANTIC_ELEMENTS = {
		'A'      : true,
		'ABBR'   : true,
		'B'      : true,
		'BDI'    : true, // HTML5
		'BDO'    : true,
		'BR'     : true,
		'CITE'   : true,
		'CODE'   : true,
		'DATA'   : true, // HTML5
		'DFN'    : true,
		'EM'     : true,
		'I'      : true,
		'KBD'    : true,
		'MARK'   : true, // HTML5
		'Q'      : true,
		'RP'     : true, // HTML5
		'RT'     : true, // HTML5
		'RUBY'   : true, // HTML5
		'S'      : true,
		'SAMP'   : true,
		'SMALL'  : true,
		'SPAN'   : true,
		'STRONG' : true,
		'SUB'    : true,
		'SUP'    : true,
		'TIME'   : true, // HTML5
		'U'      : true,
		'VAR'    : true,
		'WBR'    : true  // HTML5
	};

	/**
	 * Non-block-level elements which are nevertheless line breaking.
	 *
	 * @type {Object}
	 */
	var LINE_BREAKING_VOID_ELEMENTS = {
		'BR'  : true,
		'HR'  : true,
		'IMG' : true
	};

	/**
	 * Similar to hasBlockStyle() except relies on the nodeName of the given
	 * node which works for attached as well as and detached nodes.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 *         True if the given node is a block node type--regardless of how it
	 *         is rendered.
	 */
	function isBlockType(node) {
		return BLOCK_LEVEL_ELEMENTS[node.nodeName] || false;
	}

	/**
	 * Similar to hasInlineStyle() in the same sense as isBlockType() is similar
	 * to hasBlockStyle()
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 *         True if the given node is an inline node type--regardless of how
	 *         it is rendered.
	 */
	function isInlineType(node) {
		return !isBlockType(node);
	}

	/**
	 * Check whether the given node is a void element type.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function isVoidType(node) {
		return VOID_ELEMENTS[node.nodeName] || false;
	}

	/**
	 * Check whether the given node is a text-level semantic element type.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function isTextLevelSemanticType(node) {
		return TEXT_LEVEL_SEMANTIC_ELEMENTS[node.nodeName] || false;
	}

	/**
	 * Checks whether the given node is rendered with block style.
	 *
	 * A block node is either an Element whose "display" property does not have
	 * resolved value "inline" or "inline-block" or "inline-table" or "none", or
	 * a Document, or a DocumentFragment.
	 *
	 * Note that this function depends on style inheritance which only works if
	 * the given node is attached to the document.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 *         True if the given node is rendered with block style.
	 */
	function hasBlockStyle(node) {
		if (!node) {
			return false;
		}
		switch (node.nodeType) {
		case dom.Nodes.DOCUMENT:
		case dom.Nodes.DOCUMENT_FRAGMENT:
			return true;
		case dom.Nodes.ELEMENT:
			var style = dom.getComputedStyle(node, 'display');
			return style ? !nonBlockDisplayValuesMap[style] : isBlockType(node);
		default:
			return false;
		}
	}

	/**
	 * Checks whether the given node is rendered with inline style.
	 *
	 * An inline node is a node that is not a block node.
	 *
	 * Note that this function depends on style inheritance which only works if
	 * the given node is attached to the document.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 *         True if the given node is rendered with inline style.
	 */
	function hasInlineStyle(node) {
		return !hasBlockStyle(node);
	}

	/**
	 * Returns true for nodes that introduce linebreaks.
	 */
	function isLinebreakingNode(node) {
		return LINE_BREAKING_VOID_ELEMENTS[node.nodeName]
		    || hasBlockStyle(node);
	}

	/**
	 * Checks whether the given string represents a whitespace preservation
	 * style property.
	 *
	 * @param {String} string
	 * @return {Boolean}
	 */
	function isWhiteSpacePreserveStyle(cssWhiteSpaceValue) {
		return (cssWhiteSpaceValue === 'pre'
				|| cssWhiteSpaceValue === 'pre-wrap'
				|| cssWhiteSpaceValue === '-moz-pre-wrap');
	}

	/**
	 * Returns true if the given node is unrendered whitespace, with the caveat
	 * that it only examines the given node and not any siblings.  An additional
	 * check is necessary to determine whether the node occurs after/before a
	 * linebreaking node.
	 *
	 * Taken from
	 * http://code.google.com/p/rangy/source/browse/trunk/src/js/modules/rangy-cssclassapplier.js
	 * under the MIT license.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function isUnrenderedWhitespaceNoBlockCheck(node) {
		if (3 !== node.nodeType) {
			return false;
		}
		if (!node.length) {
			return true;
		}
		if (nonWhitespaceRx.test(node.nodeValue)) {
			return false;
		}
		var cssWhiteSpace;
		if (node.parentNode) {
			cssWhiteSpace = dom.getComputedStyle(node.parentNode, 'white-space');
			if (isWhiteSpacePreserveStyle(cssWhiteSpace)) {
				return false;
			}
		}
		if ('pre-line' === cssWhiteSpace) {
            if (/[\r\n]/.test(node.data)) {
                return false;
            }
        }
		return true;
	}

	/**
	 * Returns true if the node at point is unrendered, with the caveat that it
	 * only examines the node at point and not any siblings.  An additional
	 * check is necessary to determine whether the whitespace occurrs
	 * after/before a linebreaking node.
	 */
	function isUnrenderedAtPoint(point) {
		return (isUnrenderedWhitespaceNoBlockCheck(point.node)
				|| (1 === point.node.nodeType
					&& hasInlineStyle(point.node)
					&& !LINE_BREAKING_VOID_ELEMENTS[point.node]));
	}

	/**
	 * Tries to move the given point to the end of the line, stopping to the
	 * left of a br or block node, ignoring any unrendered nodes. Returns true
	 * if the point was successfully moved to the end of the line, false if some
	 * rendered content was encountered on the way. point will not be mutated
	 * unless true is returned.
	 *
	 * @param {Cursor} point
	 * @return {Boolean}
	 *         True if the cursor is moved.
	 */
	function skipUnrenderedToEndOfLine(point) {
		var cursor = point.clone();
		cursor.nextWhile(isUnrenderedAtPoint);
		if (!isLinebreakingNode(cursor.node)) {
			return false;
		}
		point.setFrom(cursor);
		return true;
	}

	/**
	 * Tries to move the given point to the start of the line, stopping to the
	 * right of a br or block node, ignoring any unrendered nodes. Returns true
	 * if the point was successfully moved to the start of the line, false if
	 * some rendered content was encountered on the way. point will not be
	 * mutated unless true is returned.
	 *
	 * @param {Cursor} point
	 * @return {Boolean}
	 *         True if the cursor is moved.
	 */
	function skipUnrenderedToStartOfLine(point) {
		var cursor = point.clone();
		cursor.prev();
		cursor.prevWhile(isUnrenderedAtPoint);
		if (!isLinebreakingNode(cursor.node)) {
			return false;
		}
		var isBr = ('BR' === cursor.node.nodeName);
		cursor.next(); // after/out of the linebreaking node
		// Because point may be to the right of a br at the end of a
		// block, in which case the line starts before the br.
		if (isBr) {
			var endOfBlock = point.clone();
			if (skipUnrenderedToEndOfLine(endOfBlock) && endOfBlock.atEnd) {
				cursor.skipPrev(); // before the br
				cursor.prevWhile(isUnrenderedAtPoint);
				if (!isLinebreakingNode(cursor.node)) {
					return false;
				}
				cursor.next(); // after/out of the linebreaking node
			}
		}
		point.setFrom(cursor);
		return true;
	}

	/**
	 * Tries to move the given boundary to the start of line, skipping over any
	 * unrendered nodes, or if that fails to the end of line (after a br element
	 * if present), and for the last line in a block, to the very end of the
	 * block.
	 *
	 * If the selection is inside a block with only a single empty line (empty
	 * except for unrendered nodes), and both boundary points are normalized,
	 * the selection will be collapsed to the start of the block.
	 *
	 * For some operations it's useful to think of a block as a number of lines,
	 * each including its respective br and any preceding unrendered whitespace
	 * and in case of the last line, also any following unrendered whitespace.
	 *
	 * @param {Cursor} point
	 * @return {Boolean}
	 *         True if the cursor is moved.
	 */
	function normalizeBoundary(point) {
		if (skipUnrenderedToStartOfLine(point)) {
			return true;
		}
		if (!skipUnrenderedToEndOfLine(point)) {
			return false;
		}
		if ('BR' === point.node.nodeName) {
			point.skipNext();
			// Because, if this is the last line in a block, any unrendered
			// whitespace after the last br will not constitute an independent
			// line, and as such we must include it in the last line.
			var endOfBlock = point.clone();
			if (skipUnrenderedToEndOfLine(endOfBlock) && endOfBlock.atEnd) {
				point.setFrom(endOfBlock);
			}
		}
		return true;
	}

	/**
	 * Returns true if the given node is unrendered whitespace.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function isUnrenderedWhitespace(node) {
		if (!isUnrenderedWhitespaceNoBlockCheck(node)) {
			return false;
		}
		return (
			skipUnrenderedToEndOfLine(cursors.cursor(node, false))
			||
			skipUnrenderedToStartOfLine(cursors.cursor(node, false))
		);
	}

	/**
	 * Checks whether the given DOM element is rendered empty or not.
	 *
	 * @param {DOMObject} elem
	 * @return {Boolean}
	 */
	function isEmpty(elem) {
		var child = elem.firstChild;
		while (child) {
			if (!isUnrenderedWhitespace(child)
					&& (1 === child.nodeType || 3 === child.nodeType)) {
				return false;
			}
			child = child.nextSibling;
		}
		return true;
	}

	// TODO This list is incomplete but should look something like
	// http://www.w3.org/TR/CSS21/propidx.html
	var notInheritedStyles = {
		'background-color': true,
		'underline': true
	};

	/**
	 * TODO complete the list of inherited/notInheritedStyles
	 *
	 * @param {String} styleName
	 * @return {Boolean}
	 */
	function isStyleInherited(styleName) {
		return !notInheritedStyles[styleName];
	}

	/**
	 * Returns true if the given character is a control character. Control
	 * characters are usually not rendered if they are inserted into the DOM.
	 * Returns false for whitespace 0x20 (which may or may not be rendered see
	 * isUnrenderedWhitespace()) and non-breaking whitespace 0xa0 but returns
	 * true for tab 0x09 and linebreak 0x0a and 0x0d.
	 *
	 * @param {String} chr
	 * @return {Boolean}
	 */
	function isControlCharacter(chr) {
		// Regex matches C0 and C1 control codes, which seems to be good enough.
		// "The C0 set defines codes in the range 00HEX–1FHEX and the C1
		// set defines codes in the range 80HEX–9FHEX."
		// In addition, we include \x007f which is "delete", which just
		// seems like a good idea.
		// http://en.wikipedia.org/wiki/List_of_Unicode_characters
		// http://en.wikipedia.org/wiki/C0_and_C1_control_codes
		return (/[\x00-\x1f\x7f-\x9f]/).test(chr);
	}

	/**
	 * Unicode space characters as defined in the W3 HTML5 specification:
	 * http://www.w3.org/TR/html5/infrastructure.html#common-parser-idioms
	 *
	 * @const
	 * @type {Array.<string>}
	 */
	var SPACE_CHARACTERS = [
		'\\u0009', // TAB
		'\\u000A', // LF
		'\\u000C', // FF
		'\\u000D', // CR
		'\\u0020'  // SPACE
	];

	/**
	 * Unicode zero width space characters:
	 * http://www.unicode.org/Public/UNIDATA/Scripts.txt
	 *
	 * @const
	 * @type {Array.<string>}
	 */
	var ZERO_WIDTH_CHARACTERS_UNICODES = [
		'\\u200B', // ZWSP
		'\\u200C',
		'\\u200D',
		'\\uFEFF'  // ZERO WIDTH NO-BREAK SPACE
	];

	/**
	 * Unicode White_Space characters are those that have the Unicode property
	 * "White_Space" in the Unicode PropList.txt data file.
	 *
	 * http://www.unicode.org/Public/UNIDATA/PropList.txt
	 *
	 * @const
	 * @type {Array.<string>}
	 */
	var WHITE_SPACE_CHARACTERS_UNICODES = [
		'\\u0009',
		'\\u000A',
		'\\u000B',
		'\\u000C',
		'\\u000D',
		'\\u0020',
		'\\u0085',
		'\\u00A0', // NON BREAKING SPACE ("&nbsp;")
		'\\u1680',
		'\\u180E',
		'\\u2000',
		'\\u2001',
		'\\u2002',
		'\\u2003',
		'\\u2004',
		'\\u2005',
		'\\u2006',
		'\\u2007',
		'\\u2008',
		'\\u2009',
		'\\u200A',
		'\\u2028',
		'\\u2029',
		'\\u202F',
		'\\u205F',
		'\\u3000'
	];

	var wspChars = WHITE_SPACE_CHARACTERS_UNICODES.join('');
	var zwspChars = ZERO_WIDTH_CHARACTERS_UNICODES.join('');

	/**
	 * Regular expression that matches one or more sequences of white space
	 * characters.
	 *
	 * @type {RegExp}
	 */
	var WSP_CHARACTERS = new RegExp('[' + wspChars + ']+');

	/**
	 * Regular expression that matches one or more sequences of zero width
	 * characters.
	 *
	 * @type {RegExp}
	 */
	var ZWSP_CHARACTERS = new RegExp('[' + zwspChars + ']+');

	/**
	 * Regular expression that matches one or more sequences of zero width
	 * characters or white space characters.
	 *
	 * @type {RegExp}
	 */
	var WSP_OR_ZWSP_CHARACTERS = new RegExp('[' + wspChars + zwspChars + ']');

	/**
	 * Regular expression that matches one or more sequences of white space
	 * characters at the start of a string.
	 *
	 * @type {RegExp}
	 */
	var WSP_CHARACTERS_FROM_START = new RegExp('^[' + wspChars + ']+');

	/**
	 * Regular expression that matches zero or more sequences of white space
	 * characters at the end of a string.
	 *
	 * @type {RegExp}
	 */
	var WSP_CHARACTERS_FROM_END   = new RegExp('[' + wspChars + ']+$');

	/**
	 * Checks whether or not a given text node consists of only sequence of
	 * white space characters as defined by W3 specification:
	 *
	 * http://www.w3.org/TR/html401/struct/text.html#h-9.1
	 *
	 * @param {DOMElement} textnode
	 * @return {boolean} True is node is a textnode of white characters.
	 */
	function isWhitespaces(textnode) {
		return WSP_CHARACTERS.test(textnode.data);
	}

	/**
	 * Checks whether or not a given text node consists of only sequence of
	 * zero-width characters.
	 *
	 * @param {DOMObject} textnode
	 * @return {boolean} True is node is a textnode of zero-width characters
	 */
	function isZeroWidthCharacters(textnode) {
		return ZWSP_CHARACTERS.test(textnode.data);
	}

	/**
	 * Checks whether or not a given text node consists of only sequence of
	 * zero-width characters or whitespace characters.
	 *
	 * @param {DOMObject} textnode
	 * @return {boolean} True is node is a textnode of zero-width characters
	 */
	function isWhitespaceOrZeroWidthCharacters(textnode) {
		return WSP_OR_ZWSP_CHARACTERS.test(textnode.data);
	}

	/**
	 * Checks whether the given node positioned at either extremity of it's
	 * sibling linked list.
	 *
	 * @param {DOMObject} node
	 * @return {boolean} True if node is wither the first or last child of its
	 *                   parent.
	 */
	function isTerminalSibling(node) {
		var parent = node.parentNode;
		return parent && (
			node === parent.firstChild || node === parent.lastChild
		);
	}

	/**
	 * Checks whether the given node is next to a block level elemnt.
	 *
	 * @param {DOMObject} node
	 * @return {boolean}
	 */
	function isAdjacentToBlock(node) {
		return isBlockType(node.previousSibling) || isBlockType(node.nextSibling);
	}

	/**
	 * Checks whether the given node is visually rendered according to HTML5
	 * specification.
	 *
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function isUnrenderedNode(node) {
		if (!node) {
			return true;
		}

		// Because isUnrenderedWhiteSpaceNoBlockCheck() will give us false
		// positives but never false negatives, the algorithm that will follow
		// will make certain, and will also consider unrendered <br>s.
		var maybeUnrenderedNode = isUnrenderedWhitespaceNoBlockCheck(node);

		// Because a <br> element that is a child node adjacent to its parent's
		// end tag (terminal sibling) must not be rendered.
		if (
			!maybeUnrenderedNode
				&& (node === node.parentNode.lastChild)
					&& isBlockType(node.parentNode)
						&& 'BR' === node.nodeName
		) {
			return true;
		}

		if (
			maybeUnrenderedNode
				&& (
					isTerminalSibling(node)
						|| isAdjacentToBlock(node)
							|| skipUnrenderedToEndOfLine(cursors.create(node, false))
								|| skipUnrenderedToStartOfLine(cursors.create(node, false))
				)
		) {
			return true;
		}

		return false;
	}

	/**
	 * Determine whether node `left` is visually adjacent to `right`.
	 *
	 * In the following example, <p>, <i>, and "left" are all visually adjacent
	 * to <u> and "right":
	 * <p>...<i>left</i></p><u>right</u>
	 *
	 * @param {DOMObject} left
	 * @param {DOMObject} right
	 * @return {Boolean}
	 */
	function isVisuallyAdjacent(left, right) {
		var node = traversing.previousNonAncestor(right);
		while (node) {
			if (left === node) {
				return true;
			}
			if (isUnrenderedNode(node)) {
				return isVisuallyAdjacent(left, node);
			}
			node = node.lastChild;
		}
		return false;
	}

	function isListContainer(node) {
		return 'OL' === node.nodeName || 'UL' === node.nodeName;
	}

	var isRendered = fn.complement(isUnrenderedNode);

	function hasRenderedChildren(node) {
		return isRendered(
			traversing.nextWhile(node.firstChild, isUnrenderedNode)
		);
	}

	function nextVisible(node) {
		return traversing.findForward(node, isRendered);
	}

	/**
	 * Checks whether or not the given node may be used to receive moved nodes
	 * in the process of removing a *visual* line break.
	 *
	 * The rule is simple: void elements are unsuitable because they are not
	 * permitted to contain any content, and text-level semantic elements are
	 * also unsuitable because any text-level content that would be moved into
	 * them will likely have it's semantic styling changed.
	 *
	 * @private
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function suitableTransferTarget(node) {
		return !isVoidType(node) && !isTextLevelSemanticType(node);
	}

	/**
	 * Creates a function that will insert the DOM Object that is passed to it
	 * into the given node, only if it is valid to do so. If insertion is not
	 * done because it is deemed invalid, then false is returned, other wise the
	 * function returns true.
	 *
	 * @private
	 * @param {DOMObject} ref
	 *        The node to use a reference point by which to insert DOM Objects
	 *        that will be passed into the insert function.
	 * @param {Boolean} atEnd
	 *        True if the received DOM objects should be inserted as the last
	 *        child of `ref`.  Otherwise they will be inserted before `ref` as
	 *        it's previousSibling.
	 * @return {Function(DOMObject, OutParameter):Boolean}
	 */
	function createInsertFunction(ref, atEnd) {
		if (dom.isTextNode(ref)) {
			ref = ref.parentNode;
		}
		return function insert(node, out_inserted) {
			if (node === ref) {
				return out_inserted(false);
			}
			if (ref.nodeName === node.nodeName) {
				dom.merge(ref, node);
				return out_inserted(true);
			}
			if (!content.allowsNesting(ref.nodeName, node.nodeName)) {
				return out_inserted(false);
			}
			dom.insert(node, ref, atEnd);
			dom.merge(node.previousSibling, node);
			return out_inserted(true);
		};
	}

	/**
	 * Returns an object containing the properties `start` and `move`.
	 *
	 * `start` a node that is *visually* (ignoring any unrendered nodes
	 * inbetween) to the right `node`.
	 *
	 * `move` is function that will correctly move nodes from right to left
	 * (right of `node`) starting from `start`, all the way to the visual end of
	 * the line.
	 *
	 * @param {DOMObject} node
	 *        The node that is on the left side of the join.
	 * @return {Object}
	 */
	function createTransferPivot(node) {
		var prev;
		while (node && !dom.isEditingHost(node)) {
			if (suitableTransferTarget(node)) {
				return {
					start: nextVisible(traversing.nextNonAncestor(node)),
					move: createInsertFunction(node, true)
				};
			}
			prev = node;
			node = node.parentNode;
		}
		node = traversing.nextNonAncestor(prev);
		return {
			start: nextVisible(node),
			move: createInsertFunction(node, false)
		};
	}

	/**
	 * No blocks are allowed to be moved when merginge visual line breaks, with
	 * the notable exception of list containers (ol, and ul).
	 *
	 * @private
	 * @param {DOMObject} node
	 * @return {Boolean}
	 */
	function isTransferable(node) {
		return isInlineType(node) || isListContainer(node);
	}

	/**
	 * @private
	 * @param {DOMObject} node
	 * @return {DOMObject}
	 */
	function nextTransferable(node) {
		return traversing.findForward(node, isTransferable, function (node) {
			return isLinebreakingNode(node) || dom.isEditingHost(node);
		});
	}

	/**
	 * Whether the given node can be removed.
	 *
	 * @private
	 * @param {DOMObject} node
	 * @param {OutParameter(Boolean):Boolean} out_continueMoving
	 * @return {Boolean}
	 */
	function cannotMove(node, out_continueMoving) {
		return !out_continueMoving() || !isTransferable(node);
	}

	/**
	 * Removes the visual line break between the adjacent nodes `above` and
	 * `below` by moving the nodes from `below` to above.
	 *
	 * @param {DOMObject} above
	 * @param {DOMObject} below
	 */
	function removeVisualBreak(above, below) {
		if (!isVisuallyAdjacent(above, below)) {
			return;
		}
		var pivot = createTransferPivot(above);
		var node = nextTransferable(pivot.start);
		if (node) {
			var parent = node.parentNode;
			traversing.walkUntil(
				node,
				pivot.move,
				cannotMove,
				fn.outparameter(true)
			);
			traversing.climbUntil(parent, dom.remove, hasRenderedChildren);
		}
	}

	/**
	 * Functions for working with HTML content.
	 */
	var exports = {
		isUnrenderedNode: isUnrenderedNode,
		isControlCharacter: isControlCharacter,
		isStyleInherited: isStyleInherited,
		isBlockType: isBlockType,
		isInlineType: isInlineType,
		isVoidType: isVoidType,
		isTextLevelSemanticType: isTextLevelSemanticType,
		hasBlockStyle: hasBlockStyle,
		hasInlineStyle: hasInlineStyle,
		isUnrenderedWhitespace: isUnrenderedWhitespace,
		skipUnrenderedToStartOfLine: skipUnrenderedToStartOfLine,
		skipUnrenderedToEndOfLine: skipUnrenderedToEndOfLine,
		normalizeBoundary: normalizeBoundary,
		isEmpty: isEmpty,
		isLinebreakingNode: isLinebreakingNode,
		isVisuallyAdjacent: isVisuallyAdjacent,
		isListContainer: isListContainer,
		removeVisualBreak: removeVisualBreak
	};

	exports['isUnrenderedNode'] = exports.isUnrenderedNode;
	exports['isControlCharacter'] = exports.isControlCharacter;
	exports['isStyleInherited'] = exports.isStyleInherited;
	exports['isBlockType'] = exports.isBlockType;
	exports['isInlineType'] = exports.isInlineType;
	exports['isVoidType'] = exports.isVoidType;
	exports['isTextLevelSemanticType'] = exports.isTextLevelSemanticType;
	exports['hasBlockStyle'] = exports.hasBlockStyle;
	exports['hasInlineStyle'] = exports.hasInlineStyle;
	exports['isUnrenderedWhitespace'] = exports.isUnrenderedWhitespace;
	exports['skipUnrenderedToStartOfLine'] = exports.skipUnrenderedToStartOfLine;
	exports['skipUnrenderedToEndOfLine'] = exports.skipUnrenderedToEndOfLine;
	exports['normalizeBoundary'] = exports.normalizeBoundary;
	exports['isEmpty'] = exports.isEmpty;
	exports['isLinebreakingNode'] = exports.isLinebreakingNode;
	exports['isVisuallyAdjacent'] = exports.isVisuallyAdjacent;
	exports['isListContainer'] = exports.isListContainer;
	exports['removeVisualBreak'] = exports.removeVisualBreak;

	return exports;
});