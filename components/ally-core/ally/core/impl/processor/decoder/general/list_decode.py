'''
Created on Jul 15, 2013

@package: ally core
@copyright: 2011 Sourcefabric o.p.s.
@license: http://www.gnu.org/licenses/gpl-3.0.txt
@author: Gabriel Nistor

Provides the list decoding.
'''

from ally.api.type import List, Type
from ally.container.ioc import injected
from ally.design.processor.assembly import Assembly
from ally.design.processor.attribute import defines, requires, definesIf
from ally.design.processor.branch import Branch
from ally.design.processor.context import Context
from ally.design.processor.execution import Processing, Abort
from ally.design.processor.handler import HandlerBranching
from ally.support.util_spec import IDo
import logging

# --------------------------------------------------------------------

log = logging.getLogger(__name__)

# --------------------------------------------------------------------

class Decoding(Context):
    '''
    The decoding context.
    '''
    # ---------------------------------------------------------------- Defined
    parent = defines(Context, doc='''
    @rtype: Context
    The parent decoding that this decoding is based on.
    ''')
    name = definesIf(str, doc='''
    @rtype: string
    The name of the decode.
    ''')
    children = definesIf(dict, doc='''
    @rtype: dictionary{string: Context}
    The decoding children indexed by the decoding name.
    ''')
    doDecode = defines(IDo, doc='''
    @rtype: callable(value, arguments, support)
    Decodes the value into the provided arguments.
    @param value: list[object]
        The list value to be decoded.
    @param arguments: dictionary{string: object}
        The decoded arguments.
    @param support: Context
        Support context object containing additional data required for decoding.
    ''')
    # ---------------------------------------------------------------- Required
    type = requires(Type)
    doSet = requires(IDo)
    doGet = requires(IDo)

class Support(Context):
    '''
    The decoder support context.
    '''
    # ---------------------------------------------------------------- Required
    doFailure = requires(IDo)
    
# --------------------------------------------------------------------

@injected
class ListDecode(HandlerBranching):
    '''
    Implementation for a handler that provides the list decoding.
    '''
    
    listAssembly = Assembly
    # The list item decode processors to be used for decoding.
    itemName = None
    # The name to set on the item decode, if one is required.
    
    def __init__(self):
        assert isinstance(self.listAssembly, Assembly), 'Invalid list assembly %s' % self.listAssembly
        assert self.itemName is None or isinstance(self.itemName, str), 'Invalid item name %s' % self.itemName
        super().__init__(Branch(self.listAssembly).included(), Support=Support)

    def process(self, chain, processing, decoding:Decoding, **keyargs):
        '''
        @see: HandlerBranching.process
        
        Populate the list decoder.
        '''
        assert isinstance(processing, Processing), 'Invalid processing %s' % processing
        assert isinstance(decoding, Decoding), 'Invalid decoding %s' % decoding
        
        if decoding.doDecode: return
        if not isinstance(decoding.type, List): return  # The type is not a list, just move along.
        assert isinstance(decoding.type, List)
        
        idecoding = decoding.__class__()
        assert isinstance(idecoding, Decoding), 'Invalid decoding %s' % idecoding
        
        idecoding.parent = decoding
        if Decoding.name in idecoding: idecoding.name = self.itemName
                
        idecoding.doSet = self.createSetItem(decoding.doGet, decoding.doSet)
        idecoding.type = decoding.type.itemType
        
        arg = processing.execute(decoding=idecoding, **keyargs)
        assert isinstance(arg.decoding, Decoding), 'Invalid decoding %s' % arg.decoding
        
        if arg.decoding.doDecode:
            decoding.doDecode = self.createDecode(arg.decoding.doDecode, decoding)
            if Decoding.children in decoding and Decoding.name in arg.decoding and arg.decoding.name:
                if decoding.children is None: decoding.children = {}
                decoding.children[arg.decoding.name] = arg.decoding
        else:
            log.error('Cannot decode list item %s', decoding.type.itemType)
            raise Abort(decoding)
        
    # ----------------------------------------------------------------
    
    def createSetItem(self, getter, setter):
        '''
        Create the do set for the item.
        '''
        assert isinstance(getter, IDo), 'Invalid getter %s' % getter
        assert isinstance(setter, IDo), 'Invalid setter %s' % setter
        def doSet(arguments, value):
            '''
            Do set the item value.
            '''
            previous = getter(arguments)
            if previous is None: setter(arguments, [value])
            else:
                assert isinstance(previous, list), 'Invalid previous value %s' % previous
                previous.append(value)
        return doSet
    
    def createDecode(self, decode, decoding):
        '''
        Create the do decode for list.
        '''
        assert isinstance(decode, IDo), 'Invalid decode %s' % decode
        def doDecode(value, arguments, support):
            '''
            Do decode the list.
            '''
            assert isinstance(support, Support), 'Invalid support %s' % support
            if not isinstance(value, list): support.doFailure(decoding, value)
            else:
                for item in value: decode(item, arguments, support)
        return doDecode
