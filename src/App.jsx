import { useState } from "react";
import "./App.css";

export default () => {
  const [ bpm, setBpm ] = useState( "..." );
  let chunks = [];

  navigator.mediaDevices.getUserMedia( { audio: true } ).then( stream => {
    const recorder = new MediaRecorder( stream );
    recorder.ondataavailable = ( event ) => {
      chunks.push( event.data );
      if( chunks.length % 16 == 0 ) {
        createBuffer( chunks );
        // chunks = [];
      }
    };
    recorder.start( 60 );
  } );

  const createBuffer = async ( chunks ) => {
    const blob = new Blob( chunks, { type: "audio/ogg" } );
    console.log( blob );
    const url = URL.createObjectURL( blob );
    const request = new XMLHttpRequest();
    request.open( "GET", url, true );
    request.responseType = "arraybuffer";
    request.onload = ( data ) => {
      let context = new OfflineAudioContext( 1, data.total, 44100 );
      context.decodeAudioData( request.response, ( buffer ) => {
        console.log( buffer );
        prepare( buffer, context );
      } );
    };
    request.send();
  };

  const prepare = ( buffer, context ) => {
    let source = context.createBufferSource();
    source.buffer = buffer;
    let lpf = context.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 150;
    source.connect( lpf );
    let hpf = context.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 100;
    lpf.connect( hpf );
    hpf.connect( context.destination );
    source.start( 0 );
    context.startRendering().then( renderedBuffer => process( renderedBuffer ) );
  };

  const process = ( buffer ) => {
    const peaks = getPeaks( buffer.getChannelData( 0 ) );
    console.log( peaks );
    const groups = getIntervals( peaks );
    console.log( groups );
    if( groups.length ) {
      setBpm( groups[ 0 ].tempo );
    }
  };

  /**
   * Get peaks
   * 
   * We divide audio into parts, then identify, for each part, what is
   * the loudest sample in that part. It's implied that the sample would
   * represent the most likely "beat" within that part. Each part is 0.5
   * seconds long - or 22 050 samples. This will give us 60 "beats" - we
   * will only take the loudest half of those. This will allow us to
   * ignore breaks and allow us to address tracks with a BPM below 120
   * 
   * @param data 
   */
  const getPeaks = ( data ) => {
    let size = 22050,
      parts = data.length / size,
      peaks = [];
    for( let x = 0; x < parts; x++ ) {
      let max = 0;
      for( let y = x * size; y < ( x + 1 ) * size; y++ ) {
        let volume = Math.abs( data[ y ] );
        if( ! max || ( volume > max.volume ) ) {
          max = {
            position: y,
            volume: volume
          };
        }
      }
      peaks.push( max );
    }
    // Sort peaks by volume
    peaks.sort( ( a, b ) => b.volume - a.volume );
    // Take loudest half of it
    peaks = peaks.splice( 0, peaks.length * 0.5 );
    // Sort back to based on position
    peaks.sort( ( a, b ) => a.position - b.position );
    return peaks;
  };

  /**
   * Get Intervals
   * 
   * What we do now is get all our peaks and measure the distance to
   * other peaks to create intervals. Then based on the distance between
   * those peaks (the distance of the intervals) we can calculate the BPM
   * of that particular interval.
   * 
   * The interval that is seen the most should have the BPM that
   * corresponds to the track itself.
   * 
   * @param peaks 
   */
  const getIntervals = ( peaks ) => {
    let groups = [];
    peaks.forEach( ( peak, index ) => {
      if( "position" in peak ) {
        for( let x = 1; ( index + x ) < peaks.length && x < 10; x++ ) {
          let group = {
            tempo: ( 60 * 44100 ) / ( peaks[ index + x ].position - peak.position ),
            count: 1
          };
          while( group.tempo < 90 ) {
            group.tempo *= 2;
          }
          while( group.tempo > 180 ) {
            group.tempo /= 2;
          }
          group.tempo = Math.round( group.tempo );
          if( ! groups.some( interval => ( interval.tempo === group.tempo ? interval.count++ : 0 ) ) ) {
            groups.push( group );
          }
        }          
      }
    } );
    // Sort by count
    groups.sort( ( a, b ) => b.count - a.count );
    return groups;
  };

  const getMin = ( data ) => {
    let length = data.length,
        min = Infinity;
    while( length-- ) {
      if( data[ length ] < min ) {
        min = data[ length ];
      }
    }
    return min;
  };
  
  const getMax = ( data ) => {
    let length = data.length,
        max = -Infinity;
    while( length-- ) {
      if( data[ length ] > max ) {
        max = data[ length ];
      }
    }
    return max;
  };
  
  const createBufferFromChunks = async ( chunks ) => {
    const blob = new Blob( chunks, { type: "audio/ogg" } );
    const url = URL.createObjectURL( blob );
    const request = new XMLHttpRequest();
    request.open( "GET", url, true );
    request.responseType = "arraybuffer";
    request.onload = responseBuffer => {
      const audioContext = new AudioContext();
      const context = new OfflineAudioContext( 1, responseBuffer.total, 44100 );
        let source = context.createBufferSource();
      audioContext.decodeAudioData( request.response, buffer => {
        window.originalBuffer = buffer.getChannelData( 0 );
        source = context.createBufferSource();
        source.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 150;
        source.connect( filter );
        filter.connect( context.destination );
        source.start( 0 );
        context.startRendering().then( renderedBuffer => {
          let audioContext = new AudioContext();
          let source = audioContext.createBufferSource();
          source.buffer = renderedBuffer;
          source.connect( audioContext.destination );
          bats = source.getChannelData( 0 );
          source.start();
          window.renderedBuffer = getClip( 10, 10, bats );
          window.renderedBuffer = getSampleClip( window.renderedBuffer, 300 );
          window.renderedBuffer = normalizeData( window.renderedBuffer );
          let tempo = countFlatLineGroupings( window.renderedBuffer );
          setBpm( tempo * 6 );
        } );
      } );
    };
  };

  const getClip = ( length, startTime, data ) => {
    const clipLength = length * 44100;
    const section = startTime * 44100;
    let clip = [];
    for( let x = 0; x < clipLength; x++ ) {
      clip.push( data[ startTime + x ] );
    }
    return clip;
  };

  const getSampleClip = ( data, samples ) => {
    let sampleClip = [];
    const coefficient = Math.round( data.length / samples );
    for( let x = 0; x < data.length; x++ ) {
      if( x % coefficient == 0 ) {
        sampleClip.push( data[ x ] );
      }
    }
    return sampleClip;
  };

  const normalizeData = ( data ) => {
    let normalizedData = [];
    for( let x = 0; x < data.length; x++ ) {
      normalizedData.push( Math.abs( Math.round( ( data[ x + 1 ] - data[ x ] ) * 1000 ) ) );
    }
    return normalizedData;
  };

  const countFlatLineGroupings = ( data ) => {
    let count = 0,
        max = getMax( data ),
        min = getMin( data ),
        thr = Math.round( ( max - min ) * 0.2 );
    for( var x = 0; x < data.length; x++ ) {
      if( 
        data[ x ] > thr 
        && data[ x + 1 ] < thr 
        && data[ x + 2 ] < thr 
        && data[ x + 3 ] < thr 
        && data[ x + 6 ] < thr 
      ) {
        count++;
      }
    }
    return count;
  };

  return (
    <div id="bpm">{ bpm }</div>
  );
};